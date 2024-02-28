# node-rest-api

Minimal example Node.js REST/CRUD API with TypeScript and automatically generated OpenAPI documentation and request validation using Express as web framework.

## How this project was set up

TypeScript:

```sh
# Check Node version - installed with nvm
node --version
# v20.10.0

# Create npm package
npm init -y

# Install TypeScript
npm install --save-dev typescript @types/node

# Generate tsconfig.json
npx tsc --init
# Edit tsconfig.json to use:
# {
#   "compilerOptions": {
#     "lib": ["ES2023"],
#     "module": "node16",
#     "target": "ES2022"
#     "outDir": "dist/",
#   },
#   "include": ["src/**/*"]
# }

# Install nodemon and ts-node for development
npm install --save-dev nodemon ts-node

# Add scripts to package.json:
# "build": "tsc",
# "start": "node dist/index.js",
# "dev": "nodemon src/index.ts",
# "postinstall": "npm run build"
# Create a Hello World src/index.ts file and try the scripts above

# Add to git
git init
# Add .gitignore file with dist and node_modules
# Push to github at https://github.com/peter/movies_api_node
```

Utility functions:

```sh
npm i lodash
npm i --save-dev @types/lodash
```

Web framework:

```sh
npm i express
npm i --save-dev @types/express
```

Postgres:

```sh
npm i pg
npm i --save-dev @types/pg
```

JSON schema validation:

```sh
npm i ajv
```