/* Number checker for check-powerball-numbers.html and
 * check-mega-millions-numbers.html. Results come from New York State's open
 * data (data.ny.gov), which allows reads from any site. Prize amounts are the
 * national prize chart; the page tells people to confirm with their lottery. */
(function () {
  "use strict";

  var GAMES = {
    powerball: {
      dataset: "d6yy-54nr", max: 69, bonusMax: 26, bonusName: "Powerball", cls: "pb",
      // [white matches, bonus matched] -> base prize; "J" is the jackpot
      tiers: { "5,1": "J", "5,0": 1000000, "4,1": 50000, "4,0": 100, "3,1": 100, "3,0": 7, "2,1": 7, "1,1": 4, "0,1": 4 },
      where: null
    },
    megamillions: {
      dataset: "5xaw-6ayf", max: 70, bonusMax: 24, bonusName: "Mega Ball", cls: "mm",
      tiers: { "5,1": "J", "5,0": 1000000, "4,1": 10000, "4,0": 500, "3,1": 200, "3,0": 10, "2,1": 10, "1,1": 7, "0,1": 5 },
      // Today's $5 game with a multiplier on every line began April 8, 2025
      where: "draw_date >= '2025-04-08'"
    }
  };

  var main = document.querySelector("main[data-game]");
  if (!main) return;
  var game = GAMES[main.getAttribute("data-game")];
  var latestBox = document.getElementById("latest");
  var form = document.getElementById("checker");
  var out = document.getElementById("results");
  var draws = null;

  function money(n) { return "$" + n.toLocaleString("en-US"); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function ball(n, cls, hit) {
    var b = el("i", "ball " + cls + (hit === false ? " miss" : ""), String(n));
    b.setAttribute("aria-hidden", "true");
    return b;
  }
  function longDate(iso) {
    var d = new Date(iso.slice(0, 10) + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  function shortDate(iso) {
    var d = new Date(iso.slice(0, 10) + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  function parse(row) {
    var n = String(row.winning_numbers || "").trim().split(/\s+/).map(Number);
    if (game === GAMES.powerball) {
      if (n.length < 6) return null;
      return { date: row.draw_date, whites: n.slice(0, 5), bonus: n[5], mult: Number(row.multiplier) || null };
    }
    if (n.length < 5 || !row.mega_ball) return null;
    return { date: row.draw_date, whites: n.slice(0, 5), bonus: Number(row.mega_ball), mult: null };
  }

  function showLatest() {
    latestBox.textContent = "";
    if (!draws || !draws.length) {
      latestBox.appendChild(el("p", null, "The latest results couldn't load. Check your state lottery's site, or try again in a minute."));
      return;
    }
    var d = draws[0];
    latestBox.appendChild(el("p", "when", "Latest draw: " + longDate(d.date)));
    var row = el("div", "balls");
    d.whites.forEach(function (n) { row.appendChild(ball(n, "")); });
    row.appendChild(ball(d.bonus, game.cls));
    latestBox.appendChild(row);
    var spoken = d.whites.join(", ") + ", " + game.bonusName + " " + d.bonus;
    latestBox.appendChild(el("p", "sr", "Winning numbers: " + spoken + (d.mult ? ", Power Play " + d.mult + " times" : "")));
    if (d.mult) latestBox.appendChild(el("p", "note", "Power Play " + d.mult + "×"));
    latestBox.appendChild(el("p", "src", "New results usually show here by the morning after the draw."));
  }

  function load() {
    var url = "https://data.ny.gov/resource/" + game.dataset + ".json?$limit=10&$order=draw_date%20DESC" +
      (game.where ? "&$where=" + encodeURIComponent(game.where) : "");
    fetch(url).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
      draws = rows.map(parse).filter(Boolean);
      showLatest();
    }).catch(function () { draws = []; showLatest(); });
  }

  function readPicks() {
    var inputs = form.querySelectorAll("input[data-white]");
    var whites = [], err = null;
    inputs.forEach(function (i) { whites.push(Number(i.value)); });
    var bonus = Number(form.querySelector("input[data-bonus]").value);
    if (whites.some(function (n) { return !Number.isInteger(n) || n < 1 || n > game.max; })) {
      err = "Enter 5 numbers from 1 to " + game.max + ".";
    } else if (new Set(whites).size !== 5) {
      err = "The 5 numbers must all be different.";
    } else if (!Number.isInteger(bonus) || bonus < 1 || bonus > game.bonusMax) {
      err = "Enter the " + game.bonusName + " from 1 to " + game.bonusMax + ".";
    }
    return { whites: whites, bonus: bonus, err: err };
  }

  function prizeText(base, d) {
    if (base === "J") return "Jackpot. Contact your state lottery right away.";
    if (game === GAMES.powerball) {
      var pp = form.querySelector("#addon") && form.querySelector("#addon").checked;
      if (pp && d.mult) {
        var amount = base === 1000000 ? 2000000 : base * d.mult;
        return money(amount) + " with Power Play " + d.mult + "× (" + money(base) + " without)";
      }
      return money(base) + (d.mult ? " (" + money(base === 1000000 ? 2000000 : base * d.mult) + " with Power Play)" : "");
    }
    var m = Number(form.querySelector("#mult").value);
    if (m) return money(base * m) + " with your " + m + "× multiplier";
    return money(base * 2) + " to " + money(base * 10) + ", depending on the multiplier printed on your line";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    out.textContent = "";
    var p = readPicks();
    if (p.err) { out.appendChild(el("p", "err", p.err)); return; }
    if (!draws || !draws.length) { out.appendChild(el("p", "err", "The results haven't loaded yet. Try again in a moment.")); return; }
    var wins = 0;
    var list = el("ol", "draws");
    draws.forEach(function (d) {
      var hits = d.whites.filter(function (n) { return p.whites.indexOf(n) >= 0; }).length;
      var bonusHit = d.bonus === p.bonus;
      var base = game.tiers[hits + "," + (bonusHit ? 1 : 0)];
      var li = el("li", base ? "won" : null);
      li.appendChild(el("span", "d", shortDate(d.date)));
      var row = el("span", "balls");
      d.whites.forEach(function (n) { row.appendChild(ball(n, "sm", p.whites.indexOf(n) >= 0)); });
      row.appendChild(ball(d.bonus, "sm " + game.cls, bonusHit));
      li.appendChild(row);
      var what = hits + (hits === 1 ? " number" : " numbers") + (bonusHit ? " + " + game.bonusName : "");
      li.appendChild(el("span", "r", base ? what + ": " + prizeText(base, d) : what + ": no prize"));
      if (base) wins++;
      list.appendChild(li);
    });
    out.appendChild(el("p", "sum", wins
      ? "Your numbers won in " + wins + " of the last " + draws.length + " draws. Confirm any win with your state lottery before you throw a ticket away."
      : "No prize in the last " + draws.length + " draws."));
    out.appendChild(list);
  });

  // Typing a full number moves to the next box
  form.querySelectorAll("input[inputmode=numeric]").forEach(function (i, idx, all) {
    i.addEventListener("input", function () {
      if (i.value.length >= 2 && all[idx + 1]) all[idx + 1].focus();
    });
  });

  load();
})();
