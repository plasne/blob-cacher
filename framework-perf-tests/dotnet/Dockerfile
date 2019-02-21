# build container
FROM microsoft/dotnet:sdk AS build-env
WORKDIR /app
COPY *.csproj ./
RUN dotnet restore
COPY ./Program.cs ./Program.cs
RUN dotnet publish -c Release -o out

# runtime container
FROM microsoft/dotnet:2.2-runtime
COPY --from=build-env /app/out .
COPY ./.env ./.env
ENTRYPOINT ["dotnet", "dotnet.dll"]
