import { pick, isObject, mapValues } from 'lodash'
import Ajv from 'ajv'
import express from 'express'

const ajv = new Ajv({ allErrors: true })

class ValidationError extends Error {
	statusCode = 422;
	errors: any[] = []

	constructor(message: string, schemaErrors: any[]) {
		super(message);
		this.name = 'ValidationError';
		this.errors = schemaErrors.map((schemaError) => ({
			...schemaError,
			message: [message, schemaError.message].join(' - '),
		}));
	}
}

function parametersToSchema(parameters: any) {
	const properties = parameters.reduce((acc: any, parameter: any) => {
		if (parameter.schema) acc[parameter.name] = parameter.schema;
		return acc;
	}, {});
	const required = parameters.filter((p: any) => p.required).map((p: any) => p.name);
	const additionalProperties = parameters.every((p: any) => p.in === 'headers');
	return {
		type: 'object',
		properties,
		required,
		additionalProperties,
	};
}

function childSchema(schema: any, property: string | undefined = undefined) {
	if (schema && schema.type === 'object' && schema.properties) {
		return property ? schema.properties[property] : schema.properties
	}
	if (schema && schema.type === 'array') {
		return schema.items
	}
	return undefined;
}

function coerceParameters(schema: any, value: any): any {
	if (!schema) return value;
	const { type } = schema;
	try {
		if (type === 'boolean' && typeof value === 'string') {
			return !['0', 'false', 'FALSE', 'f'].includes(value);
		}
		if ((type === 'integer' || type === 'number') && typeof value === 'string') {
			const coercedValue = Number(value);
			return Number.isNaN(coercedValue) ? value : coercedValue;
		}
		if (type === 'array' && Array.isArray(value)) {
			return value.map((v) => coerceParameters(schema.items, v));
		}
		if (type === 'array' && typeof value === 'string') {
			return value.split('|').map((v) => coerceParameters(childSchema(schema), v.trim()));
		}
		if (type === 'object' && typeof value === 'string') {
			try {
				return JSON.parse(value);
			} catch (err) {
				return value;
			}
		} else if (type === 'object' && isObject(value)) {
			return mapValues(value, (v: any, k: string) => coerceParameters(childSchema(schema, k), v));
		} else {
			return value;
		}
	} catch (err) {
		return value;
	}
}

function validateSchema(schema: any, data: any) {
	const valid = ajv.validate(schema, data);
	return valid ? undefined : ajv.errors;
}

/**
 * Validate parameters and coerce them to the right type and set default values in the request object.
 */
function processParameters(routeParameters: any, req: any) {
	for (const location of ['path', 'query', 'headers']) {
		const parameters = (routeParameters || []).filter((p: any) => p.in === location);
		const schema = parametersToSchema(parameters);
		const reqKey = location === 'path' ? 'params' : location;
		const data = coerceParameters(schema, req[reqKey]);
		for (const parameter of parameters) {
			req[reqKey] = req[reqKey] || {};
			req[reqKey][parameter.name] = data[parameter.name] ?? parameter.schema?.default;
		}
		if (schema) {
			const schemaErrors = validateSchema(schema, data);
			if (schemaErrors) {
				return new ValidationError(`${location} parameter has an invalid format`, schemaErrors);
			}
		}
	}
}

/**
 * Express middleware to validate request against the OpenAPI parameters of a route
 */
export function makeValidateRequestMiddleware(route: any) {
	async function validateRequest(req: any, _res: any, next: any) {
		const { parameters } = route;
		if (parameters) {
			const parameterError = processParameters(parameters, req);
			if (parameterError) return next(parameterError);
		}
		next();
	}
	return validateRequest;
};

function swaggerPath(expressPath: string) {
	return expressPath.replace(/:[a-zA-Z_]+/g, (m) => `{${m.substring(1)}}`);
}

function generatePaths(resourceRoutes: any[]) {
	const paths: any = {};
	for (const route of resourceRoutes) {
		const path = swaggerPath(route.path);
		paths[path] = paths[path] || {};
		const pathSpec = pick(route, ['description', 'parameters', 'responses']);
		paths[path][route.method] = pathSpec;
	}
	return paths;
}

function generateSwagger(resourceRoutes: any[]) {
	const paths = generatePaths(resourceRoutes);
	return {
		openapi: '3.1.0',
		info: {
			title: 'Node REST API',
		},
		paths,
	};
}

export function addRoutes(app: any, resourceRoutes: any[]) {
	app.get('/', (req: any, res: any) => {
		res.redirect(301, '/openapi/index.html')
	})

	app.use('/openapi', express.static('public/openapi'))

	app.get('/swagger.json', (req: any, res: any) => {
		const swagger = generateSwagger(resourceRoutes)
		res.set('Cache-Control', 'no-store')
		res.json(swagger)
	});
}
