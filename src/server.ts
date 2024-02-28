import express from 'express';
import * as articles from './routes/articles'
import * as openapi from './openapi'

const app = express();
const port = process.env.PORT || 3000;

let server;

//########################################
// ROUTES
//########################################

function addRoute(app: any, route: any) {
	const validateRequest = openapi.makeValidateRequestMiddleware(route);
	app[route.method].call(app, route.path, [validateRequest, ...(route.middleware || [])], route.handler);
}

app.get('/health', async (req, res) => {
	res.json({ status: 'ok' })
})

const resourceRoutes = [articles.routes].flat();
openapi.addRoutes(app, resourceRoutes);
for (const route of resourceRoutes) {
	addRoute(app, route);
}

//########################################
// SERVER API
//########################################

export async function startServer() {
	return new Promise((resolve) => {
		server = app.listen(port, () => {
			console.log(`Server listening on port ${port}`);
			resolve(app);
		});
	});
}
