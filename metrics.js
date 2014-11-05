#!/usr/local/bin/node
/*
curl -i https://api.github.com/orgs/intel-hadoop/members
curl -i 'https://api.github.com/repos/intel-hadoop/gearpump/commits?since=2014-10-16&until=2014-10-31'
curl -i 'https://api.github.com/repos/intel-hadoop/gearpump/pulls?state=closed&direction=asc'
curl -i https://api.github.com/repos/intel-hadoop/gearpump/stats/contributors
curl -i https://api.github.com/repos/intel-hadoop/gearpump/stats/participation
*/
function gitapi(uri, cb) {
  var request = require('request');
  var options = {
    url: 'https://api.github.com'+uri,
    auth: {
      'user': 'kkasravi',
      'pass': 'kdkkdk1'
    },
    headers: {
        'User-Agent': 'request'
    }
  };
  function callback(error, response, body) {
    if (!error && response.statusCode == 200) {
      var info = JSON.parse(body);
      cb(info);
    } else {
      console.log('statusCode='+response.statusCode+' error='+error);
    }
  }
  request(options, callback);
}

MetricsInput = (function() {
  function MetricsInput() {
    this.input = null;
    this.inputCallback = this.inputCallback.bind(this);
    getInput('/repos/intel-hadoop/team-metrics','master','/input', this.inputCallback);
  }

  MetricsInput.prototype.inputCallback = function (data) {
    this.input = JSON.parse(data);
    var self = this;
    this.input.forEach(function(team) {
      new Metrics(team)
    });
  }

  return MetricsInput;
})();

Metrics = (function() {
  function Metrics(team) {
    this.team = team;
    this.members = {};
    this.repo = null;
    this.timeRange = [];
    this.generateReport = this.generateReport.bind(this);
    this.membersCallback = this.membersCallback.bind(this);
    this.pullRequestCallback = this.pullRequestCallback.bind(this);
    this.statsCallback = this.statsCallback.bind(this);
    this.teamCallback = this.teamCallback.bind(this);
    getTeam(this.team.name, this.teamCallback);
  }

  Metrics.prototype.generateReport = function () {
    console.log(this.team.name+'\n  '+this.repo.name)
    for(var member in this.members) {
      console.log('    '+member);
      this.members[member].weeks && this.members[member].weeks.forEach(function(week) {
        console.log('      '+week.date.toDateString()+' commits:'+week.commits+' pullrequests:'+week.pullrequests+' additions:'+week.additions+' deletions:'+week.deletions);
      });
    }
    console.log('  commits:'+this.totals.commits+' pullrequests:'+this.totals.pullrequests+' additions:'+this.totals.additions+' deletions:'+this.totals.deletions+'\n');
  }

  Metrics.prototype.membersCallback = function (membersArray) {
    var self = this;
    membersArray.forEach(function(member) {
      self.members[member.login] = {}
    });
    this.team.repos.forEach(function(repo) {
      self.repo = repo;
      getStats(self.repo.name+'/stats/contributors',self.statsCallback);
    });
  }

  Metrics.prototype.pullRequestCallback = function(data) {
    var self = this;
    data.forEach(function(pull) {
      if(self.members[pull.user.login]) {
        var created = new Date(pull.created_at)
        var closed = new Date(pull.closed_at)
        if(closed.getTime() >= self.timeRange[0] && closed.getTime() < self.timeRange[1]) {
          self.members[pull.user.login].weeks[0].pullrequests++;
        } else if(closed.getTime() >= self.timeRange[1]) {
          self.members[pull.user.login].weeks[1].pullrequests++;
        }
      }
    });
    this.generateReport()
  }

  Metrics.prototype.statsCallback = function (stats) {
    var self = this;
    self.totals = {commits:0,pullrequests:0,additions:0,deletions:0};
    stats.forEach(function(stat) {
      var member = stat.author.login
      if(self.members[member]) {
        var weeks = stat.weeks.slice(-2)
        self.members[member].weeks = [];
        weeks.forEach(function(aweek,i) {
          var week = {date:new Date(),commits:0,pullrequests:0,additions:0,deletions:0};
          var time = parseInt(aweek.w+'000');
          if(i===0) {
            self.timeRange.push(time);
          }
          week.date.setTime(time);
          week.commits = parseInt(aweek.c);
          week.additions = parseInt(aweek.a);
          week.deletions = parseInt(aweek.d);
          self.members[member].weeks.push(week);
          self.totals.commits += week.commits;
          self.totals.additions += week.additions;
          self.totals.deletions += week.deletions;
        });
      }
    });
    getPullRequests(this.repo.name,this.repo.branch,this.pullRequestCallback)
  }

  Metrics.prototype.teamCallback = function (team) {
    getMembers(team.id, this.membersCallback);
  }

  return Metrics;
})();

function getInput(repo, branch, path, inputcallback) {
  function callback(repo, branch, path, data) {
    var encoded = data.content;
    var content = new Buffer(encoded, 'base64').toString('ascii');
    inputcallback(content)
  }
  gitapi(repo+'/contents'+path+'?ref='+branch,callback.bind(undefined,repo,branch,path));
}

function getTeam(team, teamcallback) {
  function teamsCallback(name, teamcallback, teams) {
    teams.some(function(team) {
      if(team.name === name) {
        teamcallback(team);
        return true;
      }
      return false;
    })
  }
  gitapi('/orgs/intel-hadoop/teams',teamsCallback.bind(undefined,team,teamcallback));
}

function getStats(repo, statscallback) {
  gitapi(repo,statscallback);
}

function getPullRequests(repo, branch, pullrequestcallback) {
  function pullRequestsCallback(repo, pullrequestcallback, data) {
    pullrequestcallback(data)
  }
  gitapi(repo+'/pulls?state=closed&branch='+branch+'&direction=desc',pullRequestsCallback.bind(undefined,repo,pullrequestcallback));
}

function getMembers(teamid,memberscallback) {
  var uri = '/teams/'+teamid+'/members';
  gitapi(uri,memberscallback);
}
function getCommits(range,commitsCallback) {
  var uri = '/teams/'+teamid+'/members';
  gitapi(uri,memberscallback);
}

new MetricsInput()
