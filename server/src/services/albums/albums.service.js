// Initializes the `albums` service on path `/albums`
const { Albums } = require('./albums.class');
const createModel = require('../../models/albums.model');
const hooks = require('./albums.hooks');

module.exports = function (app) {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/albums', new Albums(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('albums');

  service.hooks(hooks);
};
