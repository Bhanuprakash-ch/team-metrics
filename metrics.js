#!/usr/local/bin/node
/*
curl -i https://api.github.com/orgs/intel-hadoop/members
curl -i https://api.github.com/orgs/intel-hadoop/teams
curl -i 'https://api.github.com/repos/intel-hadoop/gearpump/issues?since=2014-10-16&state=open'
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
      'pass': ''
    },
    headers: {
        'User-Agent': 'request'
    }
  };
  function callback(error, response, body) {
    if (!error && (response.statusCode === 200 || response.statusCode === 202)) {
      var info = JSON.parse(body);
      cb(info);
    } else {
      console.log('uri='+uri+' statusCode='+response.statusCode+' error='+error);
    }
  }
  request(options, callback);
}

MetricsInput = (function() {
  function MetricsInput() {
    this.input = null;
    this.inputCallback = this.inputCallback.bind(this);
    var input = (process.argv.length > 2) ? process.argv[3] : 'input';
    var fs = require('fs');
    fs.readFile(input, 'utf8', this.inputCallback);
  }

  MetricsInput.prototype.inputCallback = function (err, data) {
    if(err) {
      throw err;
    }
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
    this.timeRange = Array(2);
    this.generateReport = this.generateReport.bind(this);
    this.issuesCallback = this.issuesCallback.bind(this);
    this.membersCallback = this.membersCallback.bind(this);
    this.pullRequestCallback = this.pullRequestCallback.bind(this);
    this.statsCallback = this.statsCallback.bind(this);
    this.teamCallback = this.teamCallback.bind(this);
    getTeam(this.team.name, this.teamCallback);
  }

  Metrics.prototype.generateReport = function (repo) {
    console.log(this.team.name+'\n  '+repo.name)
    for(var member in this.members) {
      console.log('    '+member);
      this.members[member].weeks && this.members[member].weeks.forEach(function(week) {
        console.log('      week of '+week.date.toDateString()+' commits:'+week.commits+' issues created:'+week.issuescreated+' pullrequests:'+week.pullrequests+' additions:'+week.additions+' deletions:'+week.deletions);
      });
    }
    console.log('  commits:'+this.totals.commits+' issues created:'+this.totals.issuescreated+' pullrequests:'+this.totals.pullrequests+' additions:'+this.totals.additions+' deletions:'+this.totals.deletions+'\n');
  }

  Metrics.prototype.issuesCallback = function (repo, issues) {
    var self = this;
    issues.forEach(function(issue) {
      if(self.members[issue.user.login]) {
        var created = new Date(issue.created_at)
        if(created.getTime() >= self.timeRange[0] && created.getTime() < self.timeRange[1]) {
          self.members[issue.user.login].weeks[0].issuescreated++;
          self.totals.issuescreated++;
        } else if(created.getTime() >= self.timeRange[1]) {
          self.members[issue.user.login].weeks[1].issuescreated++;
          self.totals.issuescreated++;
        }
      }
    });
    this.generateReport(repo)
  }

  Metrics.prototype.membersCallback = function (membersArray) {
    var self = this;
    membersArray.forEach(function(member) {
      self.members[member.login] = {}
      self.members[member.login].weeks = [
          {date:new Date(),commits:0,issuescreated:0,pullrequests:0,additions:0,deletions:0},
          {date:new Date(),commits:0,issuescreated:0,pullrequests:0,additions:0,deletions:0}
      ]
    });
    this.team.repos.forEach(function(repo) {
      getStats(repo.name+'/stats/contributors',self.statsCallback.bind(self,repo));
    });
  }

  Metrics.prototype.pullRequestCallback = function(repo, data) {
    var self = this;
    data.forEach(function(pull) {
      if(self.members[pull.user.login]) {
        var created = new Date(pull.created_at)
        var closed = new Date(pull.closed_at)
        if(closed.getTime() >= self.timeRange[0] && closed.getTime() < self.timeRange[1]) {
          self.members[pull.user.login].weeks[0].pullrequests++;
          self.totals.pullrequests++;
        } else if(closed.getTime() >= self.timeRange[1]) {
          self.members[pull.user.login].weeks[1].pullrequests++;
          self.totals.pullrequests++;
        }
      }
    });
    isNaN(this.timeRange[0]) ||
    getIssues(repo.name, new Date(this.timeRange[0]).toISOString(),this.issuesCallback.bind(this,repo));
  }

  Metrics.prototype.statsCallback = function(repo, stats) {
    var self = this, firsttime = true;
    self.totals = {commits:0,issuescreated:0,pullrequests:0,additions:0,deletions:0};
    stats.forEach(function(stat) {
      var member = stat.author.login
      if(self.members[member]) {
        var weeks = stat.weeks.slice(-2)
        weeks.forEach(function(aweek,i) {
          var time = parseInt(aweek.w+'000');
          if(firsttime) {
            self.timeRange[i] = time;
          }
          self.members[member].weeks[i].date.setTime(time);
          self.members[member].weeks[i].commits = parseInt(aweek.c);
          self.members[member].weeks[i].additions = parseInt(aweek.a);
          self.members[member].weeks[i].deletions = parseInt(aweek.d);
          self.totals.commits += self.members[member].weeks[i].commits;
          self.totals.additions += self.members[member].weeks[i].additions;
          self.totals.deletions += self.members[member].weeks[i].deletions;
        });
        firsttime = false;
      }
    });
    getPullRequests(repo.name,repo.branch,this.pullRequestCallback.bind(self,repo))
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

function getIssues(repo, since, issuescallback) {
  gitapi(repo+'/issues?'+since+'&state=open',issuescallback);
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
