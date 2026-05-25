# Multi-stage build for the .NET 10 API.
# Stage 1: restore + publish a self-contained release into /app/publish.
# Stage 2: copy publish output into a slim runtime image.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj first so the restore layer caches across code-only changes.
COPY InterviewPlatform.API.csproj ./
RUN dotnet restore InterviewPlatform.API.csproj

# Copy the rest of the project sources and publish in Release mode.
COPY . .
RUN dotnet publish InterviewPlatform.API.csproj \
    -c Release \
    -o /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Kestrel binds 0.0.0.0:$PORT — Railway injects PORT. Default 8080 for local docker runs.
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}
ENV ASPNETCORE_ENVIRONMENT=Production

COPY --from=build /app/publish ./

EXPOSE 8080
ENTRYPOINT ["dotnet", "InterviewPlatform.API.dll"]
