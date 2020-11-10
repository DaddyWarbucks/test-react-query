import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryCache, QueryCache, ReactQueryCacheProvider } from 'react-query';
import feathers from '@feathersjs/client';
import { batchClient } from 'feathers-batch/client';
import io from 'socket.io-client';
import { ReactQueryDevtools } from 'react-query-devtools';
import './App.css';

// const socket = io('http://api.my-feathers-server.com', {
//   transports: ['websocket'],
//   forceNew: true
// });
const app = feathers();
// app.configure(feathers.socketio(socket));

app.configure(feathers.rest('http://localhost:3030').fetch(fetch));

app.configure(batchClient({
  batchService: 'batch'
}));

app.configure(function () {

  app.getServiceName = (service) => {
    const [serviceName] = Object.entries(app.services).find(
      ([serviceName, serviceInstance]) => service === serviceInstance
    );
    return serviceName;
  }

  const queryCache = new QueryCache();
  app.set('queryCache', queryCache);

  app.mixins.push((service, path) => {

    service.on('created', result => {
      service.invalidateFind();
    });

    service.on('patched', result => {
      const results = Array.isArray(result) ? result : [result];
      service.invalidateFind();
      results.forEach(res => {
        service.invalidateGet(res[service.id]);
      });
    });

    service.invalidateFind = function (params) {
      const serviceName = app.getServiceName(service);
      queryCache.invalidateQueries([serviceName, 'find', params]);
    }

    service.invalidateGet = function (id, params) {
      const serviceName = app.getServiceName(service);
      queryCache.invalidateQueries([serviceName, 'get', id, params]);
    }

    service.useFind = function (params, options) {
      const serviceName = app.getServiceName(service);
      const UseQuery = (params, options) => {
        return useQuery(
          [serviceName, 'find', params],
          () => service.find(params),
          options
        );
      };
      const { data, ...rest } = UseQuery(params, options);
      return { result: data, ...rest };
    };

    service.useGet = function (id, params, options) {
      const serviceName = app.getServiceName(service);
      const UseQuery = (params, options) => {
        return useQuery(
          [serviceName, 'get', id, params],
          () => service.get(id, params),
          options
        );
      };
      const { data, ...rest } = UseQuery(params, options);
      return { result: data, ...rest };
    };

    service.useCreate = function (options) {
      const UseMutation = (options) => {
        return useMutation(
          ({ data, params }) => service.create(data, params),
          options
        );
      };
      const [mutate, { data, ...rest }] = UseMutation(options);
      return [
        (data, params) => mutate({ data, params }),
        { result: data, ...rest }
      ];
    };

    service.usePatch = function (options) {
      const UseMutation = (options) => {
        return useMutation(
          ({ id, data, params }) => service.patch(id, data, params),
          options
        );
      };
      const [mutate, { data, ...rest }] = UseMutation(options);
      return [
        (id, data, params) => mutate({ id, data, params }),
        { result: data, ...rest }
      ];
    };

  });
});

const albumsService = app.service('albums');
const artistsService = app.service('artists');

artistsService.hooks({
  before: {
    // all: [
    //   async ctx => {
    //     const prom = () => new Promise(resolve => setTimeout(resolve, 500));
    //     await prom();
    //     console.log('inflight');
    //     return ctx;
    //   }
    // ]
  },
  after: {
    find: [
      async ctx => {
        await Promise.all(ctx.result.data.map(async artist => {
          const { data } = await ctx.app.service('albums').find({
            query: { artistId: artist._id }
          });
          artist.albums = data;
        }));
      }
    ],
    get: [
      async ctx => {
        const { data } = await ctx.app.service('albums').find({
          query: { artistId: ctx.result._id }
        });
        ctx.result.albums = data;
      }
    ]
  }
});

// todosService.create({
//   id: Date.now(),
//   title: 'Do Laundry'
// });

// todosService.find().then(console.log).catch(console.error);

albumsService.on('created', album => {
  artistsService.invalidateFind();
  artistsService.invalidateGet(album.artistId);
});

albumsService.on('patched', album => {
  artistsService.invalidateFind();
  artistsService.invalidateGet(album.artistId);
});

function CreateArtist() {
  const [artist, setArtist] = useState({ name: '' });
  const [createArtist, { isLoading }] = artistsService.useCreate();
  return (
    <div style={{ margin: 15 }}>
      <input
        value={artist.name}
        onChange={({ target }) => setArtist({
          name: target.value,
        })}
      />
      <button
        disabled={isLoading}
        onClick={() => {
          createArtist(artist);
          setArtist({ name: '' });
        }}
      >
        Add Artist
        </button>
    </div>
  );
}

function CreateAlbum(props) {
  const [album, setAlbum] = useState({ name: '' });
  const [createAlbum, { isLoading }] = albumsService.useCreate();
  return (
    <div style={{ margin: 15 }}>
      <input
        value={album.name}
        onChange={({ target }) => setAlbum({
          name: target.value,
          artistId: props.artist._id,
        })}
      />
      <button
        disabled={isLoading}
        onClick={() => {
          createAlbum(album);
          setAlbum({ name: '' });
        }}
      >
        Add Album
        </button>
    </div>
  );
}

function PatchArtist(props) {
  const [artist, setArtist] = useState({ ...props.artist });
  const [patchArtist, { isLoading }] = artistsService.usePatch();

  useEffect(() => {
    setArtist({ ...props.artist });
  }, [props.artist])

  return (
    <div style={{ margin: 15 }}>
      <input
        value={artist._id}
        readOnly
        disabled
      />
      <input
        value={artist.name}
        disabled={isLoading}
        onChange={({ target }) => setArtist({
          ...artist,
          name: target.value
        })}
      />
      <button
        disabled={isLoading}
        onClick={() => {
          patchArtist(artist._id, artist);
        }}
      >
        Update Artist
      </button>

      <ul>
        {artist.albums && artist.albums.map(album => {
          return (
            <li key={album._id}>{album.name}</li>
          );
        })}
      </ul>

      <div style={{ margin: 15 }}>
        <CreateAlbum artist={artist} />
      </div>

    </div>
  );
}

function App() {
  return (
    <ReactQueryCacheProvider queryCache={app.get('queryCache')}>
      <List />
      <List />
    </ReactQueryCacheProvider>
  );
}

function List() {

  // Queries
  const useFind = artistsService.useFind();
  const useGet = artistsService.useGet(
    useFind.result?.data[0]?._id,
    null,
    { enabled: useFind.result?.data[0]?._id }
  );

  if (useFind.isLoading) {
    return <h1>Loading</h1>
  }

  if (useFind.isError) {
    return <h1>{useFind.error.message}</h1>
  }

  return (
    <div style={{ display: 'flex' }}>
      <div style={{ width: '50%', display: 'inline-block' }}>
        <ul>
          {useFind.result.data.map(artist => (
            <li key={artist._id} style={{ marginBottom: 15 }}>
              <PatchArtist artist={artist} />
            </li>
          ))}
        </ul>

        <CreateArtist />
      </div>

      <div style={{ width: '50%', display: 'inline-block' }}>
        {useGet.result && (
          <PatchArtist artist={useGet.result} />
        )}

      </div>

      <ReactQueryDevtools initialIsOpen />
    </div >
  )
}

export default App;
