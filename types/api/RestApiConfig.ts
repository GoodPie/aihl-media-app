export type IRestApiConfig = {
    id: string;
    name: string;
    description: string;
    environment?: string;
    allowCredentials?: boolean;
    allowMethods?: string[];
    allowHeaders?: string[];
    allowOrigins?: string[];
}
