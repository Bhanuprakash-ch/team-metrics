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
    this.membersCallback = this.membersCallback.bind(this);
    this.pullRequestCallback = this.pullRequestCallback.bind(this);
    this.statsCallback = this.statsCallback.bind(this);
    this.teamCallback = this.teamCallback.bind(this);
    getTeam(this.team.name, this.teamCallback);
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
    console.log(this.team.name+'\n  '+this.repo.name)
    data.forEach(function(pull) {
      if(self.members[pull.user.login]) {
        var created = new Date(pull.created_at)
        var closed = new Date(pull.closed_at)
        //if(closed.getTime() > self.timeRange[0] && closed.getTime() < self.timeRange[1]) {
//console.log(pull.base.repo.name+' '+pull.user.login+' closed '+closed.getTime()+' timeRange[0] '+self.timeRange[0]);
        if(closed.getTime() > self.timeRange[0]) {
          console.log('    '+pull.user.login);
          console.log('      '+created.toDateString()+' closed '+closed.toDateString())
        }
      }
    });
  }

  Metrics.prototype.statsCallback = function (stats) {
    console.log(this.team.name+'\n  '+this.repo.name)
    var self = this;
    var totals = {commits:0,additions:0,deletions:0};
    stats.forEach(function(stat) {
      var member = stat.author.login
      if(self.members[member]) {
        console.log('    '+member);
        self.members[member].weeks = stat.weeks.slice(-2)
        self.members[member].weeks.forEach(function(week,i) {
          var date = new Date()
          var time = parseInt(week.w+'000');
          date.setTime(time);
          if(i===0) {
//console.log('setting self.timeRange '+date.toDateString());
            self.timeRange.push(time);
          }
          var commit = parseInt(week.c);
          var additions = parseInt(week.a);
          var deletions = parseInt(week.d);
          totals.commits += commit;
          totals.additions += additions;
          totals.deletions += deletions;
          console.log('      '+date.toDateString()+' commits:'+week.c+' additions:'+week.a+' deletions:'+week.d);
        });
      }
    });
    console.log('  commits:'+totals.commits+' additions:'+totals.additions+' deletions:'+totals.deletions+'\n');
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
