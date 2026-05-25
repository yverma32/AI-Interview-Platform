using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;

namespace InterviewPlatform.API.Services;

public class RedisCacheService : ICacheService
{
    private readonly IDistributedCache _cache;
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public RedisCacheService(IDistributedCache cache) => _cache = cache;

    public async Task<T?> GetAsync<T>(string key) where T : class
    {
        var bytes = await _cache.GetAsync(key);
        if (bytes is null || bytes.Length == 0) return null;
        return JsonSerializer.Deserialize<T>(bytes, JsonOpts);
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan ttl) where T : class
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value, JsonOpts);
        await _cache.SetAsync(key, bytes, new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl });
    }

    public Task RemoveAsync(string key) => _cache.RemoveAsync(key);
}

public class NullCacheService : ICacheService
{
    public Task<T?> GetAsync<T>(string key) where T : class => Task.FromResult<T?>(null);
    public Task SetAsync<T>(string key, T value, TimeSpan ttl) where T : class => Task.CompletedTask;
    public Task RemoveAsync(string key) => Task.CompletedTask;
}
