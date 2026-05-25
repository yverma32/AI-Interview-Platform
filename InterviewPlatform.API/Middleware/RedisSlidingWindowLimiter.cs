using System.Threading.RateLimiting;
using StackExchange.Redis;

namespace InterviewPlatform.API.Middleware;

/// <summary>
/// Distributed sliding-window rate limiter backed by a Redis ZSET.
/// Each request adds a timestamped entry; entries older than the window are trimmed; if cardinality
/// after trim exceeds permitLimit the request is rejected. The whole check is atomic via a Lua script.
/// </summary>
public sealed class RedisSlidingWindowLimiter : RateLimiter
{
    private readonly IDatabase _redis;
    private readonly string _key;
    private readonly int _permitLimit;
    private readonly TimeSpan _window;

    // Atomic sliding-window check. KEYS[1] = redis key, ARGV[1] = now (ms), ARGV[2] = window (ms),
    // ARGV[3] = limit, ARGV[4] = unique member id.
    private const string LuaScript = @"
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local member = ARGV[4]
        redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
        local current = redis.call('ZCARD', key)
        if current < limit then
            redis.call('ZADD', key, now, member)
            redis.call('PEXPIRE', key, window)
            return {1, limit - current - 1}
        else
            return {0, 0}
        end";

    public RedisSlidingWindowLimiter(IDatabase redis, string key, int permitLimit, TimeSpan window)
    {
        _redis = redis;
        _key = key;
        _permitLimit = permitLimit;
        _window = window;
    }

    public override TimeSpan? IdleDuration => null;

    public override RateLimiterStatistics GetStatistics() => new()
    {
        CurrentAvailablePermits = _permitLimit,
        CurrentQueuedCount = 0
    };

    protected override RateLimitLease AttemptAcquireCore(int permitCount)
    {
        // Fire-and-forget sync path — used rarely by the framework; defer to async.
        return AcquireAsyncCore(permitCount, CancellationToken.None).AsTask().GetAwaiter().GetResult();
    }

    protected override async ValueTask<RateLimitLease> AcquireAsyncCore(int permitCount, CancellationToken cancellationToken)
    {
        if (permitCount > _permitLimit)
            return new RedisLease(false, 0);

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var member = $"{now}:{Guid.NewGuid():N}";

        try
        {
            var result = (RedisValue[]?)await _redis.ScriptEvaluateAsync(
                LuaScript,
                new RedisKey[] { _key },
                new RedisValue[] { now, (long)_window.TotalMilliseconds, _permitLimit, member });

            if (result is null || result.Length < 2) return new RedisLease(false, 0);
            var allowed = (long)result[0] == 1;
            var remaining = (int)(long)result[1];
            return new RedisLease(allowed, remaining);
        }
        catch
        {
            // Fail-open: if Redis is down, don't lock everyone out.
            return new RedisLease(true, _permitLimit);
        }
    }

    private sealed class RedisLease : RateLimitLease
    {
        public RedisLease(bool acquired, int remaining)
        {
            IsAcquired = acquired;
            _remaining = remaining;
        }

        private readonly int _remaining;
        public override bool IsAcquired { get; }
        public override IEnumerable<string> MetadataNames => new[] { "X-RateLimit-Remaining" };

        public override bool TryGetMetadata(string metadataName, out object? metadata)
        {
            if (metadataName == "X-RateLimit-Remaining")
            {
                metadata = _remaining;
                return true;
            }
            metadata = null;
            return false;
        }
    }
}
