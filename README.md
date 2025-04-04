# AIHL Media Team Infrastructure

## Overview
This project provides the infrastructure for the AIHL (Australian Ice Hockey League) Media Team application, specifically designed for the Perth Thunder team. It's a serverless application built on AWS using the Cloud Development Kit (CDK) with TypeScript.

The application enables management of teams, players, games, and game events, with a focus on supporting media operations during ice hockey games.

## Architecture

The infrastructure consists of several AWS services organized into modular constructs:

### Authentication
- **Cognito User Pool**: Manages user authentication and authorization
- **Admin Group**: Special permissions for administrators
- **App Client**: Enables application access to the authentication service

### Database
- **DynamoDB Tables**:
  - Teams: Stores team information
  - Players: Stores player information with team associations
  - Games: Tracks game schedules and statuses
  - Events: Records game events (goals, penalties, etc.)
  - Templates: Stores templates for different event types

### Storage
- **S3 Buckets**:
  - Assets Bucket: Stores media assets (images, videos, etc.)
  - Website Bucket: Hosts the static website files

### Lambda Functions
- **Serverless Functions**:
  - Team Management: Handles CRUD operations for teams
  - Player Management: Handles CRUD operations for players
  - Game Management: Handles CRUD operations for games
  - Event Tracking: Handles CRUD operations for game events and templates

### API Gateway
- **REST API**: Exposes endpoints for teams, players, games, events, and templates
- **Cognito Authorizer**: Secures write operations with user authentication
- **CORS Support**: Enables cross-origin requests

### CloudFront Distribution
- **Content Delivery Network**:
  - Serves the static website
  - Provides access to media assets
  - Routes API requests to the API Gateway

## Deployment

### Prerequisites
- Node.js (v14 or later)
- AWS CLI configured with appropriate credentials
- AWS CDK installed globally (`npm install -g aws-cdk`)

### Setup
1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Bootstrap the CDK (if not already done):
   ```
   npx cdk bootstrap
   ```
4. Deploy the stack:
   ```
   npx cdk deploy
   ```

### Outputs
After deployment, the CDK will output important information:
- API Gateway URL
- CloudFront Distribution URL
- Cognito User Pool ID and Client ID
- S3 Bucket names

## Development

### Project Structure
- `bin/`: Contains the CDK app entry point
- `lib/`: Contains the CDK stack and constructs
  - `constructs/`: Modular infrastructure componentss
- `lambda/`: Contains the Lambda function code
- `frontend/`: Contains the web frontend code

### Useful Commands
- `npm run build`: Compile TypeScript to JavaScript
- `npm run watch`: Watch for changes and compile
- `npm run test`: Run tests
- `npx cdk deploy`: Deploy the stack
- `npx cdk diff`: Compare deployed stack with current state
- `npx cdk synth`: Generate CloudFormation template
