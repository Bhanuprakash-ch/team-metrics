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

Metrics = (function() {
  function Metrics(team, org, repo) {
    this.team = team;
    this.org = org;
    this.repo = repo
  }

  Metrics.prototype.addMembers = function (members) {
    this.members = members;
  }
  return Metrics;
})();


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

function pullRequestCallback(data) {
  data.forEach(function(pull) {
    if(metrics.members[pull.user.login]) {
      var created = new Date(pull.created_at)
      var closed = new Date(pull.closed_at)
      console.log(pull.base.repo.name+' '+pull.user.login+' created '+created.toDateString()+' closed '+closed.toDateString())
    }
  });
}

function getPullRequests(repo, pullrequestcallback) {
  function pullRequestsCallback(repo, pullrequestcallback, data) {
    pullrequestcallback(data)
  }
  gitapi(repo+'/pulls?state=closed&direction=asc',pullRequestsCallback.bind(undefined,repo,pullrequestcallback));
}


function membersCallback(team, repo, membersArray) {
  var members = {}
  membersArray.forEach(function(member) {
    members[member.login] = {}
  });
  function statsCallback(team, repo, members, stats) {
    console.log(team+'\n  '+repo)
    var totals = {commits:0,additions:0,deletions:0};
    stats.forEach(function(stat) {
      var member = stat.author.login
      if(members[member]) {
        console.log('    '+member);
        members[member].weeks = stat.weeks.slice(-2)
        members[member].weeks.forEach(function(week) {
          var date = new Date()
          date.setTime(parseInt(week.w+'000'));
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
    metrics.addMembers(members);
    console.log('  commits:'+totals.commits+' additions:'+totals.additions+' deletions:'+totals.deletions+'\n');
    getPullRequests(repo,pullRequestCallback)
  }
  function getStats(repo, statscallback) {
    gitapi(repo,statscallback);
  }
  getStats(repo+'/stats/contributors',statsCallback.bind(undefined, team, repo, members));
}

function getMembers(teamid,memberscallback) {
  var uri = '/teams/'+teamid+'/members';
  gitapi(uri,memberscallback);
}
function getCommits(range,commitsCallback) {
  var uri = '/teams/'+teamid+'/members';
  gitapi(uri,memberscallback);
}
function teamCallback(memberscallback, team) {
  getMembers(team.id,memberscallback);
}
var metrics = new Metrics('intel-hadoop', 'gearpump', 'gearpump')
//getTeam('oryx',teamCallback.bind(undefined,membersCallback.bind(undefined, 'oryx', '/repos/OryxProject/oryx')))
getTeam('gearpump',teamCallback.bind(undefined,membersCallback.bind(undefined, 'gearpump','/repos/intel-hadoop/gearpump')))
//getTeam('spark',teamCallback.bind(undefined,membersCallback.bind(undefined, 'spark','/repos/apache/spark')))
