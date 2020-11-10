const { BatchService } = require('feathers-batch');

const albums = require('./albums/albums.service.js');
const artists = require('./artists/artists.service.js');

// eslint-disable-next-line no-unused-vars
module.exports = function (app) {
  app.use('batch', new BatchService(app));
  const batchService = app.service('batch');
  batchService.hooks({
    before: {
      all: [
        context => {
          console.log('Hello from batch!');
          console.log(context.data.calls);
        }
      ]
    }
  });

  app.configure(albums);
  app.configure(artists);
};
