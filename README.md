[![Code Climate](https://codeclimate.com/repos/55e2d6d1e30ba068cf016ef1/badges/d9e8881bb2d5f332acb3/gpa.svg)](https://codeclimate.com/repos/55e2d6d1e30ba068cf016ef1/feed)

team-metrics
============

Uses nodejs and github-api v3 to fetch metrics.

## Usage:

``` npm install ``` - install all modules for metrics

in command line use ./metrics.js -u {github user} -p {token or password} -w {how many weeks you want to search back} [input]

## Input file:

You need to edit input file for getting statistics. There is an example how you can do that:

```
{
    "name": "{team name from project projects i.e Owners}",
    "repos": [
    {
        "name": "/repos/{name of organisation}/{name of project}",
        "branch": "master"
    }
    ]
}
```


