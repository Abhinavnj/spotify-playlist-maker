'use strict'

require('dotenv').config();
var express = require('express');
var request = require('request');
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
// var sleep = require('system-sleep');
var EventEmitter = require('events').EventEmitter;
const fs = require('fs');
const { promisify } = require('util')
const sleep = promisify(setTimeout)

// Credentials
// var client_id = '937069d2cb8a4a38ae34f89659ace174';
var client_id = process.env.CLIENT_ID;
var client_secret = process.env.CLIENT_SECRET;
var redirect_uri = process.env.REDIRECT_URI;

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

// function msleep(n) {
//     Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
// }
// function sleep(n) {
//     msleep(n * 1000);
// }

/********** USE STATEMENTS **********/

app.use(express.static(__dirname + '/public')) // Sends automatically to index.html
    .use(cors())
    .use(cookieParser())

    .use(session({
        secret: 'secret',
        resave: true,
        saveUninitialized: true
    }))
    .use(bodyParser.urlencoded({ extended: true }));
//    .use(bodyParser.json());

app.use(bodyParser.json());

/********** ROUTES **********/

// Authorize login to spotify, then redirect to redirect_uri
app.get('/login', (req, res) => {
    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // Application requests authorization
    // var scope = 'user-read-private user-read-email';
    var scope = 'user-follow-modify playlist-modify-private';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        })
    );
    console.log(res);
});

let getArtist = function (token) {
    var info = {
        'name': '',
        'id': ''
    };
    var options = {
        url: 'https://api.spotify.com/v1/search?q=post%20malone&type=artist&limit=1',
        dataType: 'json',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    request.get(options, function (error, response, body) {
        body = JSON.parse(response.body);
        info['name'] = body["artists"]["items"][0]["name"];
        info['id'] = body["artists"]["items"][0]["id"];

        return info;
    });
    return info;
}

// Create playlist callback
// app.get('/create', (req, res) => {
async function createPlaylist(name, description, username, token) {
    var options = {
        // url: 'https://api.spotify.com/v1/users/' + process.env.USERNAME + '/playlists',
        url: 'https://api.spotify.com/v1/users/' + username + '/playlists',
        body: JSON.stringify({
            'name': name,
            'description': description,
            'public': false
        }),
        dataType: 'json',
        headers: {
            // 'Authorization': 'Bearer ' + req.query.myAccessToken,
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
        }
    };
    request.post(options, function (error, response, body) {
        body = JSON.parse(response.body);
        console.log(body["id"]);
        var playlistID = body["id"]
        var playlist_json = JSON.stringify({ 'playlist': playlistID });
        playlist_json = JSON.parse(playlist_json);

        fs.readFile('tracks.json', function (err, data) {
            var json = JSON.parse(data);
            json.push(playlist_json);

            fs.writeFile('tracks.json', JSON.stringify(json), function (err, result) {
                if (err) {
                    console.log('error', err);
                }
                process_id(token);
            });
            
        });
        // res.send(response);
    });
}
// });

function process_id(token) {
    fs.readFile('tracks.json', function (err, data) {
        var json = JSON.parse(data);
        console.log(json);
        var playlist_id = json[json.length - 1]["playlist"];
        var new_tracks = [];
        for (var i = 0; i < json.length - 1; i++) {
            new_tracks.push(json[i]["track"]);
        }
        populatePlaylist(playlist_id, new_tracks, token);
    });
}

function populatePlaylist(playlist_id, new_tracks, token) {
    console.log('id:', playlist_id);
    var url = 'https://api.spotify.com/v1/playlists/' + playlist_id + '/tracks?uris=';
    for (var j = 0; j < new_tracks.length; j++) {
        if (j != new_tracks.length - 1) {
            url = url + new_tracks[j] + '%2C';
        }
        else {
            url = url + new_tracks[j];
        }
    }
    console.log(url);

    var options = {
        url: url,
        dataType: 'json',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    request.post(options, function (error, response, body) {
        if (error) {
            console.log(error);
        }
        console.log(response.body);
    });
    fs.writeFile('tracks.json', '[]', function (err, result) {
        if (err) {
            console.log('error', err);
        }
    });
}

function getID(artistList, token) {
    console.log(artistList);
    for (var c = 0; c < artistList.length; c++) {
        // for (var c = 0; c < 1; c++) {
        var options1 = {
            url: 'https://api.spotify.com/v1/search?q=' + artistList[c] + '&type=artist&limit=1',
            dataType: 'json',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
        // console.log(options);
        request.get(options1, function (error, response, body) {
            body = JSON.parse(response.body);
            console.log('getID', body);
            var id = '';
            if (body["artists"] == undefined) {
                id = '0';
            } else {
                id = body["artists"]["items"][0]["id"];
            }
            var id_json = JSON.stringify({ 'id': id });
            id_json = JSON.parse(id_json);

            fs.readFile('output.json', function (err, data) {
                var json = JSON.parse(data);
                if (id_json["id"] != 0) {
                    json.push(id_json);
                }

                fs.writeFile('output.json', JSON.stringify(json), function (err, result) {
                    if (err) {
                        console.log('error', err);
                    }
                });
            });
        });
    }
}

app.get('/recommendations', async (req, res) => {
    var artists = [req.query.artist2, req.query.artist3, req.query.artist4, req.query.artist5];
    var genres = [req.query.genre1, req.query.genre2];
    var url = 'https://api.spotify.com/v1/recommendations?';
    // URL parameters to be binded
    var params = {
        limit: 50,
        market: 'US',
        target_danceablity: .6,
        seed_artists: [req.query.artist1],
        seed_genres: []
    }
    // Add artists to url parameters
    for (var i = 0; i < artists.length; i++) {
        if (artists[i].length > 0) {
            params.seed_artists.push(artists[i]);
        }
    }
    // Add genres to url parameters
    for (var i = 0; i < genres.length; i++) {
        if (genres[i].length > 0) {
            params.seed_genres.push(genres[i]);
        }
    }

    // Get param artists ready for URL
    for (var x = 0; x < params.seed_artists.length; x++) {
        params.seed_artists[x] = params.seed_artists[x].split(' ').join('%20');
    }

    // Change artist names to ID
    getID(params.seed_artists, req.session.access_token);
    await sleep(10000);

    // params.seed_artists[0] = '3TVXtAsR1Inumwj472S9r4';
    // params.seed_artists[1] = '246dkjvS1zLTtiykXe5h60';

    // Populate params: artists with IDs
    var newArtists = [];
    var json = fs.readFileSync('output.json');
    json = JSON.parse(json);
    // json = JSON.stringify(json);

    for (var id in json) {
        newArtists.push(json[id]['id']);
    }
    params.seed_artists = newArtists;

    // fs.writeFileSync('output.json', '[]', function (err, result) {
    //     if(err) console.log('error', err);
    // });

    // Bind paramters to URL
    for (var key in params) {
        if (key != 'seed_artists' && key != 'seed_genres') {
            var value = params[key];
            var toBeInserted = key + '=' + value;
            if (url[url.length - 1] == '?') {
                url = url + toBeInserted;
            } else {
                url = url + '&' + toBeInserted;
            }
        } else if (key == 'seed_artists' && params.seed_artists.length > 0) {
            // , -> %2C
            // ' ' in artist name -> %20
            var insertArtists = '&' + key + '=';
            for (var a = 0; a < params.seed_artists.length; a++) {
                // params.seed_artists[a] = params.seed_artists[a].split(' ').join('%20');
                insertArtists = insertArtists + params.seed_artists[a] + '%2C';
            }
            insertArtists = insertArtists.slice(0, -3);
            url = url + insertArtists;
        } else if (key == 'seed_genres' && params.seed_genres.length > 0) {
            var insertGenres = '&' + key + '=';
            for (var b = 0; b < params.seed_genres.length; b++) {
                params.seed_genres[b] = params.seed_genres[b].split(' ').join('%20');
                insertGenres = insertGenres + params.seed_genres[b] + '%2C';
            }
            insertGenres = insertGenres.slice(0, -3);
            url = url + insertGenres;
        }
    }

    console.log(url);

    var options = {
        url: url,
        headers: {
            'Authorization': 'Bearer ' + req.session.access_token,
            'Content-Type': 'application/json'
        }
    };
    request.get(options, async (error, response, body) => {
        fs.writeFileSync('output.json', '[]', function (err, result) {
            if(err) {
                console.log('error', err);
            }
        });
        body = JSON.parse(response.body);
        var tracks = [];
        for (var i = 0; i < body["tracks"].length; i++) {
            // console.log(body["tracks"]);
            var track = body["tracks"][i]["uri"];
            track = track.split(':').join('%3A');
            tracks.push(track);
        }
        fs.readFile('tracks.json', function (err, data) {
            var json = JSON.parse(data);
            for (var j = 0; j < tracks.length; j++) {
                var track_json = JSON.stringify({ 'track': tracks[j] });
                track_json = JSON.parse(track_json);
                json.push(track_json);
            }

            fs.writeFile('tracks.json', JSON.stringify(json), function (err, result) {
                if (err) {
                    console.log('error', err);
                }
                createPlaylist(req.query.name, req.query.description, req.query.username, req.session.access_token);
            });
        });
        // createPlaylist(req.query.name, req.query.description, req.session.access_token);
        // await sleep(2000);
        // process_id(req.session.access_token);
        // res.send(response.body);
        res.send("Check your spotify account for your playlist!");
    });

    // populatePlaylist(req.session.access_token);
});

app.get('/callback', (req, res) => {

    // Application requests refresh and access tokens
    // after checking the state parameter
    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            })
        );
    }
    else {
        res.clearCookie(stateKey);
        var authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
            },
            json: true
        };

        request.post(authOptions, (error, response, body) => {
            if (!error && response.statusCode === 200) {

                var access_token = body.access_token,
                    refresh_token = body.refresh_token;

                req.session.access_token = access_token;

                // var options = {
                //     url: 'https://api.spotify.com/v1/me',
                //     headers: { 'Authorization': 'Bearer ' + access_token },
                //     json: true
                // };

                // use the access token to access the Spotify Web API (call API in here using access_token)
                // request.get(options, (error, response, body) => {
                //     console.log(body);
                // });

                // we can also pass the token to the browser to make requests from there
                res.redirect('/#' +
                    querystring.stringify({
                        access_token: access_token,
                        refresh_token: refresh_token
                    })
                );
            }
            else {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    })
                );
            }
        });
    }
});

app.get('/refresh_token', (req, res) => {

    // requesting access token from refresh token
    var refresh_token = req.query.refresh_token;
    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            var access_token = body.access_token;
            res.send({
                'access_token': access_token
            });
        }
    });
});

var PORT = process.env.PORT || 11111;
app.listen(PORT, () => {
    console.log('Listening on port ' + PORT + '...');
});

// Useful Links
// https://developer.spotify.com/documentation/web-api/reference/playlists/get-a-list-of-current-users-playlists/
// https://developer.spotify.com/documentation/web-api/reference-beta/#endpoint-replace-playlists-tracks