// TODO
const ARTICLE_RESPONSE_SCHEMA = {
	type: 'object'
}

//########################################
// HANDLERS
//########################################

async function getArticle() {

}

async function listArticles() {

}

function getRoute() {
	const parameters = [
		{
			name: 'id',
			in: 'path',
			description: `ID of resource to fetch`,
			required: true,
			schema: { type: "integer" },
		},
	];

	const responseSchema = {
		type: 'object',
		properties: {
			show: ARTICLE_RESPONSE_SCHEMA,
		},
		required: ['show'],
		additionalProperties: false,
	};

	return {
		method: 'get',
		path: '/articles/:id',
		middleware: [],
		handler: getArticle,
		parameters,
		responses: {
			200: {
				description: `One article`,
				content: {
					'application/json': {
						schema: responseSchema,
					},
				},
			},
			404: {
				description: `Not found`,
			},
		},
	};
}

function listRoute() {
	const parameters: any[] = [];

	const responseSchema = {
		type: 'object',
		properties: {
			articles: {
				type: 'array',
				items: ARTICLE_RESPONSE_SCHEMA,
			},
		},
		required: ['articles'],
		additionalProperties: false,
	};

	return {
		method: 'get',
		path: '/articles',
		middleware: [],
		handler: listArticles,
		parameters,
		responses: {
			200: {
				description: `List of articles`,
				content: {
					'application/json': {
						schema: responseSchema,
					},
				},
			},
		},
	};
}

export const routes = [listRoute(), getRoute()];
