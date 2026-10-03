// The Angular dev server forwards every /api request to the Helpdesk API,
// so the app calls `/api/...` on its own origin and needs no CORS setup.
// `yarn start:helpdesk` sets HELPDESK_API_PORT to the port the API got;
// without it (e.g. `nx serve helpdesk` on its own) the API's default, 3000.
const apiPort = process.env['HELPDESK_API_PORT'] ?? '3000';

export default {
  '/api': {
    target: `http://localhost:${apiPort}`,
    secure: false,
  },
};
