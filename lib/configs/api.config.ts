import type {IRestApiConfig} from "@apiTypes/RestApiConfig";
import {Cors, Period} from "aws-cdk-lib/aws-apigateway";

export const AIHLMediaRestApi: IRestApiConfig = {
    id: "aihl-media-day-api",
    name: "AIHL Game Day API",
    description: "API for AIHL Media game day management",
    environment: "prod",
    allowMethods: Cors.ALL_ORIGINS,
    allowHeaders: ["Authorization", "Content-Type", "*"], // TODO: Remove *
    allowOrigins: Cors.ALL_ORIGINS,
    allowCredentials: true,
}

export const AIHLApiGatewayConfig = {
    AuthoriserName: 'AIHLMediaAuthoriser',
    RequestValidatorName: 'RequestValidator',
    ApiKeyName: 'ApiKey',
    UsagePlanName: 'UsagePlan',
}

export const ResourceConfig = {
    "team": {
        item: "team",
        collection: "teams",
    },
    "player": {
        item: "player",
        collection: "players",
    },
    "game": {
        item: "game",
        collection: "games",
    },
    "event": {
        item: "event",
        collection: "events",
    },
    "template": {
        item: "template",
        collection: "templates",
    },
    "category": {
        item: "category",
        collection: "categories",
    },
    "status": {
        item: "status",
        collection: "statuses",
    },
}
