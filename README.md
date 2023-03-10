# Endpoint 

## CSV

- Create a directory `csv` in the root of this project
- Add `WUR_portal.csv` to it

The directory and its files are excluded from Git but the code _expects_ `./csv/WUR_portal.csv` to exist

## Serving the JSON

I've compared a few different methods for serving the _entire_, _largest_ CSV file transformed to JSON. Note that compare these methods _by eye_. (I haven't used any timings!)

**Start** the server in a terminal

```bash
npm start
```

Use `curl` in another terminal to request the data

### 1 `res.send(buffer)`

This can accept an _object_ which Express will transform to JSON for dispatch, or it can accept a _buffer_ of JSON string data read from the file system. In this case it is using a _buffer_

It is noticeably slower than streaming, but adequate


```bash
curl --verbose http://localhost:3001/send
```

### 2 `res.sendFile(FILE_PATH)`

This is, of course, the built-in streaming mechanism for file data and there is no delay _at all_, which is what we want

```bash
curl --verbose http://localhost:3001/send-file
```

### 3. `createReadStream(FILE_PATH).pipe(res)`

Remember, I compared by eye and I can't imagine why this might be faster than `sendFile` but it seems to me that piping to the response from `createReadStream` is faster

```bash
curl --verbose http://localhost:3001/create-read-stream
```

### 4 `res.send(object)`

As an alternative to _1_ I wondered whether using an in-memory object would be faster than reading to a buffer from the file system. I don't think it is


```bash
curl --verbose http://localhost:3001/in-memory
```

### Conclusion

I can't say what the latency would be like in production but in development there's no _significant_ delay in serving the _entire_, _largest_ CSV file transformed to JSON with any of these methods

However, _streaming_ is definitely the way to go

## Filtering the JSON

Filtering 140,000 rows of data takes no time at all. Well, of course it takes _some_ time, but the majority of time taken up by _filtering_ is taken up by _opening_ and _parsing_ the JSON file

As discussed, we can stream data immediately provided the data exists in the form we want it to be in. Where it does not exist, provided we can create it _and then stream it_ (so, use `sendFile` rather than `send`, for example, or pipe to the response from a stream) we can reduce the latency _on our side_ almost entirely

As a comparison, I put together some endpoints using different methods for filtering and dispatching the data

Each of these approaches use the same algorithm but different mechanisms to get there

- if a file exists then send that
- Otherwise generate the file
- Send that

Be sure to **restart** the server in a terminal when _changing between routes_ because otherwise you will re-use any generated JSON 👈

```bash
npm start
```

Use curl in another terminal to request the data. You can request filtered data for any year between 2013 and 2020

Be sure to request the same year _twice_ to see the difference between first and subsequent requests

But also be sure to **restart** the server when changing between routes! ☝️

### 1 `/year/:year`

This reads the entire JSON data from the file system, filters it, dispatches the data, and then writes the filtered JSON back to the file system when the `send` has closed to be used for subsequent requests

```bash
curl --verbose http://localhost:3001/year/2013
```

### 2 `/middleware/year/:year`

This is a variation on _1_ but it uses _middleware_ to generate the filtered JSON and `sendFile` to dispatch it

```bash
curl --verbose http://localhost:3001/middleware/year/2013
```

### 3 `/in-memory/year/:year`

This is a variation on _2_ but it uses an _in memory_ object to filter then writes the result to the file system to stream

```bash
curl --verbose http://localhost:3001/in-memory/year/2013
```

### 4 `/memorymap/year/:year`

This is a variation on _3_ but it uses the _in memory_ object to filter then stores the result in a _map_. It _does not_ stream!

```bash
curl --verbose http://localhost:3001/memorymap/year/2013
```
