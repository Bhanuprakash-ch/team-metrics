#!/usr/bin/node
/*
GIT
curl -i 'https://api.github.com/orgs/trustedanalytics/members'
curl -i 'https://api.github.com/orgs/trustedanalytics/teams'
curl -i 'https://api.github.com/repos/trustedanalytics/gearpump/issues?since=2014-10-16&state=open'
curl -i 'https://api.github.com/repos/trustedanalytics/gearpump/commits?since=2014-10-16&until=2014-10-31'
curl -i 'https://api.github.com/repos/trustedanalytics/gearpump/pulls?state=closed&direction=asc'
curl -i 'https://api.github.com/repos/trustedanalytics/gearpump/stats/contributors'
curl -i 'https://api.github.com/repos/trustedanalytics/gearpump/stats/participation'
JIRA
curl -i 'https://issues.apache.org/jira/rest/api/2/search?jql=project%20%3D%20YARN%20AND%20resolution%20in%20(Unresolved%2C%20Fixed)%20AND%20assignee%20in%20(acmurthy)%20'
curl -i 'https://issues.apache.org/jira/rest/api/2/search?jql=project%20%3D%20HDFS%20AND%20resolution%20in%20(Unresolved%2C%20Fixed)%20AND%20assignee%20in%20(rvadali)%20'
curl -i 'https://issues.apache.org/jira/rest/api/2/search?jql=resolved%20%3E%3D%20%222014%2F11%2F14%22%20AND%20assignee%20in%20(lirui%2C%20libo-intel%2C%20clockfly%2C%20HuafengWang%2C%20whjiang%2C%20%22jingcheng.du%40intel.com%22%2C%20mauzhang%2C%20%22chengxiang%20li%22%2C%20drankye%2C%20jiajia)'
'resolved >= "2014/11/14" AND assignee in (lirui, libo-intel, clockfly, HuafengWang, whjiang, "jingcheng.du@intel.com", mauzhang, "chengxiang li", drankye, jiajia'
*/
function gitapi(user, password, uri, cb) {
  var request = require('request');
  var options = {
    url: 'https://api.github.com'+uri,
    auth: {
      'user': user,
      'pass': password
    },
    headers: {
        'User-Agent': 'request'
    }
  };
  function callback(error, response, body) {
    if (!error && (response.statusCode === 200)) {
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
    var self = this;
    this.charts = [];
    this.input = null;
    this.program = process.argv[1];
    this.teams = [];
    this.team = null;
    this.howManyWeeks = 2;
    this.oneDay = 24*60*60*1000;
    this.timeRanges = Array(this.howManyWeeks);
    this.generateGraph = this.generateGraph.bind(this);
    this.inputCallback = this.inputCallback.bind(this);
    this.usage = this.usage.bind(this);
    var options = process.argv.slice(2), user, password;
    options.map(function(arg,i) {
      switch(arg) {
        case "-h":
          self.usage();
          break;
        case "-u":
          user = options[i+1];
          break;
        case "-p":
          password = options[i+1];
          break;
        case "-t":
          self.team = options[i+1];
          break;
        case "-w":
          self.howManyWeeks = options[i+1];
          break;
        default:
          break;
      }
    });
    if(!user || !password) {
      this.usage();
    }
    gitapi = gitapi.bind(undefined, user, password);
    var input = (arguments.length > 4) ? process.argv[4] : 'input';
    var fs = require('fs');
    fs.readFile(input, 'utf8', this.inputCallback);
  }

  MetricsInput.prototype.generateGraph = function () {
    var self = this;
    var howManyDays = self.oneDay*7*self.howManyWeeks-self.oneDay
    var commits = {
      chart: {
        type:'pie'
      },
      title: {
        text: 'Commits from '+new Date(this.timeRanges[0]).toDateString()+' to '+
          new Date(this.timeRanges[0]+howManyDays).toDateString()
      },
      xAxis: {
        type: 'category',
        showEmpty: false
      },
      yAxis: {
        showEmpty: false
      },
      legend: {
        showEmpty: false
      },
      plotOptions: {
          series: {
              borderWidth: 0,
              dataLabels: {
                  enabled: true
              }
          }
      },
      series: [{
          name: 'Commits',
          colorByPoint: true,
          data: [],
          type: 'column'
      }],
      drilldown: {
          series: []
      }
    };
    self.teams.forEach(function(team) {
      team.team.repos.forEach(function(repo) {
        var repoG = {};
        repoG.name = repo.name.split('/').pop();
        repoG.y = repo.totals.commits;
        var id = repoG.name+'_members';
        repoG.drilldown = id;
        commits.series[0].data.push(repoG);
        var repoM = {id: id, data: []};
        for(var member in repo.members) {
          repo.members[member].weeks &&
            repoM.data.push([member,repo.members[member].weeks.reduce(function(p,c){return p.commits+c.commits;})]);
        }
        commits.drilldown.series.push(repoM);
      });
    });
    self.charts.push(commits);
    console.log(JSON.stringify(commits));
  }

  MetricsInput.prototype.inputCallback = function (err, data) {
    var self = this;
    if(err) {
      throw err;
    }
    this.input = JSON.parse(data);
    this.input = this.team ? 
      this.input.filter(function(team){
        if(self.team===team.name) {
          return true;
        }
        return false;
      }): this.input;
    this.input.forEach(function(team) {
      self.teams.push(new Metrics(self, team));
    });
    setTimeout(self.generateGraph, 10000);
  }

  MetricsInput.prototype.usage = function () {
    console.log("usage: "+this.program+' -u user -p password [input]');
    console.log("  -u: user");
    console.log("  -p: password");
    console.log("  -t: team");
    console.log("  input: input file");
    process.exit(0);
  }

  return MetricsInput;
})();

Metrics = (function() {
  function Metrics(metricsInput, team) {
    this.team = team;
    this.metricsInput = metricsInput;
    this.repoMap = {};
    this.timeRanges = Array(this.metricsInput.howManyWeeks);
    this.createMembersWeeks = this.createMembersWeeks.bind(this);
    this.generateReport = this.generateReport.bind(this);
    this.getWeekIndex = this.getWeekIndex.bind(this);
    this.issuesCallback = this.issuesCallback.bind(this);
    this.membersCallback = this.membersCallback.bind(this);
    this.pullRequestCallback = this.pullRequestCallback.bind(this);
    this.statsCallback = this.statsCallback.bind(this);
    this.teamCallback = this.teamCallback.bind(this);
    getTeam(this.team.name, this.teamCallback);
    return this;
  }

  Metrics.prototype.generateReport = function (repo) {
    console.log(this.team.name+'\n  '+repo.name)
    for(var member in repo.members) {
      if(repo.members[member].weeks && repo.members[member].weeks.length) {
        console.log('    '+member);
        repo.members[member].weeks.forEach(function(week) {
          console.log('      week of '+week.date.toDateString()+' commits:'+week.commits+' issues (created/modified:'+week.issues.created+', assigned:'+week.issues.assigned+') pullrequests:'+week.pullrequests+' additions:'+week.additions+' deletions:'+week.deletions);
          if(week.issues.items && week.issues.items.length) {
            console.log('        issues:');
            week.issues.items.forEach(function(issue) {
              console.log('          '+issue.type+': '+issue.title);   
            });
          }
        });
      }
    }
    console.log('  commits:'+repo.totals.commits+' issues (created/modified:'+repo.totals.issues.created+', assigned:'+repo.totals.issues.assigned+') pullrequests:'+repo.totals.pullrequests+' additions:'+repo.totals.additions+' deletions:'+repo.totals.deletions+'\n');
  }

  Metrics.prototype.getWeekIndex = function (time) {
    var self=this;
    var weekIndex = Math.floor((time - self.timeRanges[0])/(self.metricsInput.oneDay*7))
    return weekIndex < 0 ? 0 : weekIndex;
  }

  Metrics.prototype.issuesCallback = function (repo, issues) {
    var self = this, weekIndex;
    issues = issues.filter(function(issue){return issue.pull_request?false:true;});
    issues.forEach(function(issue) {
      if(repo.members[issue.user.login]) {
        var created = new Date(issue.created_at)
        weekIndex = self.getWeekIndex(created.getTime());
        self.createMembersWeeks(repo, issue.user.login);
        repo.members[issue.user.login].weeks[weekIndex].issues.created++;
        repo.members[issue.user.login].weeks[weekIndex].issues.items.push({type:'created/modified',label:((issue.labels && issue.labels.length) ? issue.labels[0].name: ''),title:issue.title});
        repo.totals.issues.created++;
      }
      if(issue.assignee && repo.members[issue.assignee.login]) {
        var assigned = new Date(issue.created_at)
        weekIndex = self.getWeekIndex(assigned.getTime());
        repo.members[issue.assignee.login].weeks[weekIndex].issues.assigned++;
        repo.members[issue.assignee.login].weeks[weekIndex].issues.items.push({type:'assigned',title:issue.title});
        repo.totals.issues.assigned++;
      }
    });
    this.generateReport(repo)
  }

  Metrics.prototype.membersCallback = function (membersArray) {
    var self = this;
    this.team.repos.forEach(function(repo) {
      self.repoMap[repo.name] = repo;
      repo.members = {};
      membersArray.forEach(function(member) {
        repo.members[member.login] = {}
      });
      getStats(repo.name+'/stats/contributors',self.statsCallback.bind(self,repo));
    });
  }

  Metrics.prototype.pullRequestCallback = function(repo, data) {
    var self = this;
    data.forEach(function(pull) {
      if(repo.members[pull.user.login]) {
        var created = new Date(pull.created_at)
        var closed = new Date(pull.closed_at)
        var weekIndex = self.getWeekIndex(closed.getTime());
        self.createMembersWeeks(repo, pull.user.login);
        repo.members[pull.user.login].weeks[weekIndex].pullrequests++;
        repo.totals.pullrequests++;
      }
    });
    isNaN(this.timeRanges[0]) ||
    getIssues(repo.name, new Date(this.timeRanges[0]).toISOString(),this.issuesCallback.bind(this,repo));
  }

  Metrics.prototype.createMembersWeeks = function(repo, member) {
    var self = this;
    if(!repo.members[member].weeks) {
      repo.members[member].weeks = [];
      for(var j=0; j < self.metricsInput.howManyWeeks; j++) {
        repo.members[member].weeks.push({date:new Date(),commits:0,issues:{created:0,assigned:0,items:[]},pullrequests:0,additions:0,deletions:0})
      }
    }
  }
  Metrics.prototype.statsCallback = function(repo, stats) {
    var self = this, firsttime = true;
    repo.totals = {commits:0,issues:{created:0,assigned:0,items:[]},pullrequests:0,additions:0,deletions:0};
    stats.forEach(function(stat) {
      var member = stat.author.login
      if(repo.members[member]) {
        var weeks = stat.weeks.slice(-self.metricsInput.howManyWeeks)
        weeks.forEach(function(aweek,i) {
          var time = parseInt(aweek.w+'000');
          if(firsttime) {
            self.timeRanges[i] = self.metricsInput.timeRanges[i] = time;
          }
          self.createMembersWeeks(repo, member);
          repo.members[member].weeks[i].date.setTime(time);
          repo.members[member].weeks[i].commits = parseInt(aweek.c);
          repo.members[member].weeks[i].additions = parseInt(aweek.a);
          repo.members[member].weeks[i].deletions = parseInt(aweek.d);
          repo.totals.commits += repo.members[member].weeks[i].commits;
          repo.totals.additions += repo.members[member].weeks[i].additions;
          repo.totals.deletions += repo.members[member].weeks[i].deletions;
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
  gitapi('/orgs/trustedanalytics/teams',teamsCallback.bind(undefined,team,teamcallback));
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
