# Multi-stage build for the .NET 10 API.
# Build context is the REPO ROOT (Railway loads it that way), so all COPY paths are
# qualified with InterviewPlatform.API/.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src/InterviewPlatform.API

# Copy csproj first so the restore layer caches across code-only changes.
COPY InterviewPlatform.API/InterviewPlatform.API.csproj ./
RUN dotnet restore

# Copy the rest of the project sources and publish in Release mode.
# Working from inside the project dir ensures MSBuild's default Compile/EmbeddedResource
# globs ("**/*.cs", "**/*.resx") resolve correctly against the project root.
COPY InterviewPlatform.API/ ./
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_ENVIRONMENT=Production
# Default for local `docker run` without -e PORT. Railway injects PORT, which the
# entrypoint shim reads at runtime and feeds into ASPNETCORE_URLS.
ENV PORT=8080
# Frontend (Vercel) and API (Railway) are on different origins, so cookies must be
# SameSite=None; Secure to survive cross-site requests on iOS Safari + Chrome ITP.
# This env var maps to Cookies:CrossSite in the .NET config system (__ = section separator).
ENV COOKIES__CROSSSITE=true

COPY --from=build /app/publish ./

EXPOSE 8080

# Shell form so $PORT is expanded at container start, not at image build time.
ENTRYPOINT ["/bin/sh", "-c", "ASPNETCORE_URLS=http://+:${PORT} exec dotnet InterviewPlatform.API.dll"]
