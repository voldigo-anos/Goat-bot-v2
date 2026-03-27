const moment = require("moment-timezone");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

let loadImage, createCanvas, registerFont;
let canvasAvailable = false;

try {
  const canvas = require("canvas");
  loadImage = canvas.loadImage;
  createCanvas = canvas.createCanvas;
  registerFont = canvas.registerFont;
  canvasAvailable = true;
} catch (error) {
  console.error("Canvas module not available:", error.message);
}

let fonts;
try {
  fonts = require('../../func/font.js');
} catch (error) {
  console.log("Fonts module not found, using fallback");
}

if (canvasAvailable && registerFont) {
  try {
    const fontDir = path.join(__dirname, 'assets', 'font');
    if (fs.existsSync(path.join(fontDir, 'BeVietnamPro-Bold.ttf'))) {
      registerFont(path.join(fontDir, 'BeVietnamPro-Bold.ttf'), { family: 'BeVietnamPro-Bold' });
    }
    if (fs.existsSync(path.join(fontDir, 'BeVietnamPro-Regular.ttf'))) {
      registerFont(path.join(fontDir, 'BeVietnamPro-Regular.ttf'), { family: 'BeVietnamPro-Regular' });
    }
  } catch (error) {
    console.log("Font registration error:", error.message);
  }
}

if (canvasAvailable) {
  try {
    if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();
        return this;
      };
    }
  } catch (error) {
    console.log("Canvas context polyfill error:", error.message);
  }
}

const LIMIT_INTERVAL_HOURS = 12;
const MAX_PLAYS = 25;
const MAX_BET = 10000000;
const MIN_BET = 1000;

const WHEEL_SEGMENTS = [
  { label: "🏆 JACKPOT", multiplier: 25, probability: 0.015, type: "jackpot", emoji: "🏆", color: "#FFD700" },
  { label: "💎 DIAMOND", multiplier: 10, probability: 0.025, type: "premium", emoji: "💎", color: "#B9F2FF" },
  { label: "🔥 MEGA WIN", multiplier: 7, probability: 0.04, type: "big", emoji: "🔥", color: "#FF7F00" },
  { label: "⭐ GOLD", multiplier: 5, probability: 0.06, type: "medium", emoji: "⭐", color: "#FFD700" },
  { label: "💰 SILVER", multiplier: 3, probability: 0.10, type: "small", emoji: "💰", color: "#C0C0C0" },
  { label: "🔔 BRONZE", multiplier: 2, probability: 0.15, type: "tiny", emoji: "🔔", color: "#CD7F32" },
  { label: "🍀 LUCKY", multiplier: 1.5, probability: 0.20, type: "mini", emoji: "🍀", color: "#00FF00" },
  { label: "➖ BREAK EVEN", multiplier: 1, probability: 0.15, type: "even", emoji: "➖", color: "#808080" },
  { label: "😢 HALF LOSS", multiplier: 0.5, probability: 0.10, type: "loss", emoji: "😢", color: "#FF6B6B" },
  { label: "💸 TOTAL LOSS", multiplier: 0, probability: 0.08, type: "loss", emoji: "💸", color: "#FF0000" },
  { label: "⚡ BANKRUPT", multiplier: 0, probability: 0.07, type: "bankrupt", emoji: "⚡", color: "#800080", fee: 0.15 }
];

const SPECIAL_EVENTS = [
  { name: "DOUBLE TROUBLE", trigger: 0.02, effect: (multiplier) => multiplier * 2 },
  { name: "TRIPLE THREAT", trigger: 0.005, effect: (multiplier) => multiplier * 3 },
  { name: "LUCKY CLOVER", trigger: 0.03, effect: (multiplier) => multiplier + 0.5 },
  { name: "GOLDEN SPIN", trigger: 0.01, effect: (multiplier) => multiplier * 1.5 }
];

function formatMoney(amount) {
  if (isNaN(amount)) return "0";
  amount = Number(amount);
  const scales = [
    { value: 1e15, suffix: "Q" },
    { value: 1e12, suffix: "T" },
    { value: 1e9, suffix: "B" },
    { value: 1e6, suffix: "M" },
    { value: 1e3, suffix: "k" }
  ];
  const scale = scales.find(s => amount >= s.value);
  if (scale) {
    const scaled = amount / scale.value;
    const formatted = Math.abs(scaled).toFixed(1);
    const clean = formatted.endsWith(".0") ? formatted.slice(0, -2) : formatted;
    return `${amount < 0 ? "-" : ""}${clean}${scale.suffix}`;
  }
  return amount.toLocaleString();
}

module.exports = {
  config: {
    name: "wheel",
    aliases: ["spin", "roue"],
    version: "5.0",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: {
      fr: "🎡 Jouez à la roue de la fortune avec jackpot progressif et événements spéciaux",
      en: "🎡 Play Wheel of Fortune with progressive jackpot and special events"
    },
    category: "game",
    guide: {
      fr: "{pn} <mise> – Faire tourner la roue\n{pn} info – Voir les infos\n{pn} stats – Vos statistiques\n{pn} leaderboard – Classement\n{pn} jackpot – Jackpot actuel",
      en: "{pn} <bet> – Spin the wheel\n{pn} info – Show info\n{pn} stats – Your stats\n{pn} leaderboard – Leaderboard\n{pn} jackpot – Current jackpot"
    }
  },

  onStart: async function ({ message, args, event, usersData, api }) {
    const { senderID, threadID, messageID } = event;
    const command = args[0]?.toLowerCase();

    if (command === "info") {
      const infoMsg = `
🎡 ━━━━━━━━━━━━━━━━━━━━━ 🎡
       WHEEL OF FORTUNE
           v5.0 PREMIUM
🎡 ━━━━━━━━━━━━━━━━━━━━━ 🎡

💰 BET RANGE: ${MIN_BET.toLocaleString()} - ${MAX_BET.toLocaleString()}
🎯 MAX SPINS: ${MAX_PLAYS} every ${LIMIT_INTERVAL_HOURS} hours
🎊 PROGRESSIVE JACKPOT: Grows with every spin!

━━━━━━ WHEEL SEGMENTS ━━━━━━
${WHEEL_SEGMENTS.map(seg => 
  `• ${seg.emoji} ${seg.label.padEnd(15)} x${seg.multiplier} (${(seg.probability * 100).toFixed(1)}%)`
).join('\n')}

━━━━━━ SPECIAL FEATURES ━━━━━━
• 🎰 Random Multipliers (2x-3x)
• 🔥 Win Streak Bonuses
• 🏆 Progressive Jackpot Pool
• ⚡ Daily Bonus Spins
• 🎁 Mystery Box Rewards

━━━━━━ COMMANDS ━━━━━━
• ${this.config.name} <amount>   - Spin the wheel
• ${this.config.name} info       - Show this info
• ${this.config.name} stats      - Your statistics
• ${this.config.name} leaderboard - Top players
• ${this.config.name} jackpot    - Current jackpot

🎯 TIP: Higher bets increase jackpot contribution!
      `.trim();
      return message.reply(fonts?.bold ? fonts.bold(infoMsg) : infoMsg);
    }

    if (command === "stats") {
      const user = await usersData.get(senderID);
      const stats = user.data?.wheelStats || {
        totalSpins: 0,
        totalWon: 0,
        totalWagered: 0,
        biggestWin: 0,
        currentStreak: 0,
        highestStreak: 0,
        jackpotsWon: 0,
        lastSpins: []
      };
      const winRate = stats.totalSpins > 0 ? ((stats.totalWon / stats.totalWagered) * 100).toFixed(2) : 0;
      const statsMsg = `
📊 ━━━━━━━ YOUR WHEEL STATS ━━━━━━ 📊

🎡 TOTAL SPINS: ${stats.totalSpins}
💰 TOTAL WON: ${formatMoney(stats.totalWon)}
🎯 TOTAL WAGERED: ${formatMoney(stats.totalWagered)}
📈 WIN RATE: ${winRate}%
🏆 BIGGEST WIN: ${formatMoney(stats.biggestWin)}
🔥 CURRENT STREAK: ${stats.currentStreak}
⚡ HIGHEST STREAK: ${stats.highestStreak}
🎰 JACKPOTS WON: ${stats.jackpotsWon || 0}

━━━━━━ RECENT ACTIVITY ━━━━━━
${stats.lastSpins?.slice(-5).map((spin, i) => 
  `• Spin ${i+1}: ${spin.result || "N/A"}`
).join('\n') || "No recent spins"}
      `.trim();
      return message.reply(fonts?.bold ? fonts.bold(statsMsg) : statsMsg);
    }

    if (command === "leaderboard") {
      const allUsers = await usersData.getAll();
      const leaderboardData = allUsers
        .filter(user => user.data?.wheelStats?.totalSpins > 0)
        .map(user => {
          const stats = user.data.wheelStats;
          const netProfit = stats.totalWon - (stats.totalWagered || 0);
          return {
            name: user.name,
            uid: user.userID,
            netProfit: netProfit,
            totalWon: stats.totalWon || 0,
            totalSpins: stats.totalSpins || 0,
            jackpots: stats.jackpotsWon || 0
          };
        })
        .sort((a, b) => b.netProfit - a.netProfit)
        .slice(0, 10);

      let leaderboardMsg = "🏆 ━━━━━━━ WHEEL LEADERBOARD ━━━━━━ 🏆\n\n";
      if (leaderboardData.length === 0) {
        leaderboardMsg = "No players have spun the wheel yet! Be the first! 🎡";
      } else {
        leaderboardData.forEach((user, index) => {
          const medals = ["🥇", "🥈", "🥉"];
          const medal = medals[index] || `▫️`;
          const profitIcon = user.netProfit >= 0 ? "💰" : "📉";
          leaderboardMsg += `${medal} ${user.name}\n`;
          leaderboardMsg += `   ${profitIcon} Net Profit: ${formatMoney(user.netProfit)}\n`;
          leaderboardMsg += `   🎡 Spins: ${user.totalSpins}\n`;
          leaderboardMsg += `   🏅 Jackpots: ${user.jackpots}\n`;
          leaderboardMsg += `   📊 Total Won: ${formatMoney(user.totalWon)}\n\n`;
        });
      }
      return message.reply(fonts?.bold ? fonts.bold(leaderboardMsg) : leaderboardMsg);
    }

    if (command === "jackpot") {
      const allUsers = await usersData.getAll();
      let totalJackpot = 0;
      allUsers.forEach(user => {
        totalJackpot += user.data?.progressiveJackpot || 0;
      });
      const jackpotMsg = `
🎰 ━━━━━━━ PROGRESSIVE JACKPOT ━━━━━━ 🎰

🏆 CURRENT JACKPOT: ${formatMoney(totalJackpot)}
💰 MINIMUM WIN: ${formatMoney(totalJackpot * 0.5)}
💎 MAXIMUM WIN: ${formatMoney(totalJackpot * 2)}

━━━━━━ HOW TO WIN ━━━━━━
• Land on 🏆 JACKPOT segment
• Win the entire progressive pool
• Jackpot resets after win
• 1% of every bet contributes

🎯 Next Spin Could Be Yours!
      `.trim();
      return message.reply(fonts?.bold ? fonts.bold(jackpotMsg) : jackpotMsg);
    }

    if (!args[0]) {
      const usageMsg = `🎡 WHEEL OF FORTUNE\n\nUsage: ${this.config.name} <bet amount>\nMinimum: ${MIN_BET.toLocaleString()}\nMaximum: ${MAX_BET.toLocaleString()}\n\nOther commands:\n• ${this.config.name} info\n• ${this.config.name} stats\n• ${this.config.name} leaderboard\n• ${this.config.name} jackpot`;
      return message.reply(fonts?.bold ? fonts.bold(usageMsg) : usageMsg);
    }

    const bet = parseInt(args[0].replace(/\D/g, ''));
    if (isNaN(bet) || bet < MIN_BET) {
      return message.reply(fonts?.bold ? fonts.bold(`❌ Minimum bet is ${MIN_BET.toLocaleString()} coins.`) : `❌ Minimum bet is ${MIN_BET.toLocaleString()} coins.`);
    }
    if (bet > MAX_BET) {
      return message.reply(fonts?.bold ? fonts.bold(`❌ Maximum bet is ${MAX_BET.toLocaleString()} coins.`) : `❌ Maximum bet is ${MAX_BET.toLocaleString()} coins.`);
    }

    const user = await usersData.get(senderID);
    const now = Date.now();

    const wheelStats = user.data?.wheelStats || {
      totalSpins: 0,
      totalWon: 0,
      totalWagered: 0,
      biggestWin: 0,
      currentStreak: 0,
      highestStreak: 0,
      jackpotsWon: 0,
      lastSpins: []
    };

    const validSpins = wheelStats.lastSpins.filter(time => now - time < LIMIT_INTERVAL_HOURS * 3600 * 1000);
    if (validSpins.length >= MAX_PLAYS) {
      const nextSpinTime = new Date(validSpins[0] + LIMIT_INTERVAL_HOURS * 3600 * 1000);
      const timeMsg = `⏰ SPIN LIMIT REACHED!\n\nYou've used ${MAX_PLAYS} spins in ${LIMIT_INTERVAL_HOURS} hours.\nNext spin available: ${nextSpinTime.toLocaleTimeString()}\nUse "${this.config.name} stats" to check your usage.`;
      return message.reply(fonts?.bold ? fonts.bold(timeMsg) : timeMsg);
    }

    if (user.money < bet) {
      const needed = bet - user.money;
      const fundsMsg = `💸 INSUFFICIENT FUNDS!\n\nCurrent Balance: ${formatMoney(user.money)}\nBet Amount: ${formatMoney(bet)}\nNeeded: ${formatMoney(needed)} more coins`;
      return message.reply(fonts?.bold ? fonts.bold(fundsMsg) : fundsMsg);
    }

    await usersData.set(senderID, {
      money: user.money - bet,
      "data.wheelStats.totalWagered": (wheelStats.totalWagered || 0) + bet
    });

    validSpins.push(now);
    const jackpotContribution = Math.floor(bet * 0.02);
    const currentJackpot = (user.data?.progressiveJackpot || 0) + jackpotContribution;
    await usersData.set(senderID, {
      "data.progressiveJackpot": currentJackpot,
      "data.wheelStats.lastSpins": validSpins.slice(-MAX_PLAYS),
      "data.wheelStats.totalSpins": wheelStats.totalSpins + 1
    });

    let spinMessage;
    try {
      spinMessage = await api.sendMessage("🎡 Initializing Premium Wheel...", threadID);
    } catch (e) {
      console.error("Failed to send initial message:", e);
      return;
    }

    const spinEmojis = ["🎡", "🌀", "⚡", "🌟"];
    const spinMessages = [
      "Spinning the wheel...",
      "Wheel gaining speed...",
      "Almost there...",
      "Determining your fate..."
    ];
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      try {
        const emoji = spinEmojis[i % spinEmojis.length];
        const msg = spinMessages[Math.floor(i / 1) % spinMessages.length];
        await api.editMessage(`${emoji} ${msg}`, spinMessage.messageID);
      } catch (e) {
        console.error("Animation error:", e);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));

    const random = Math.random();
    let cumulativeProb = 0;
    let result = null;
    for (const segment of WHEEL_SEGMENTS) {
      cumulativeProb += segment.probability;
      if (random < cumulativeProb) {
        result = { ...segment };
        break;
      }
    }
    if (!result) result = { ...WHEEL_SEGMENTS[0] };

    let specialEvent = null;
    for (const event of SPECIAL_EVENTS) {
      if (Math.random() < event.trigger) {
        specialEvent = event;
        result.multiplier = event.effect(result.multiplier);
        result.label += ` ✨ ${event.name}`;
        break;
      }
    }

    let baseWinnings = Math.floor(bet * result.multiplier);
    let jackpotWin = 0;
    let specialBonus = 0;

    if (result.type === "jackpot") {
      jackpotWin = Math.floor(currentJackpot * (0.5 + Math.random()));
      await usersData.set(senderID, {
        "data.progressiveJackpot": 0,
        "data.wheelStats.jackpotsWon": (wheelStats.jackpotsWon || 0) + 1
      });
    }
    if (result.type === "bankrupt") {
      const fee = Math.floor(bet * result.fee);
      baseWinnings = -fee;
    }

    let newStreak = result.multiplier > 1 ? wheelStats.currentStreak + 1 : 0;
    if (newStreak >= 3) {
      specialBonus = Math.floor(bet * (newStreak - 2) * 0.25);
    }
    const highestStreak = Math.max(wheelStats.highestStreak || 0, newStreak);

    const totalWinnings = Math.max(0, baseWinnings) + jackpotWin + specialBonus;
    const finalBalance = user.money - bet + totalWinnings;

    const updatedStats = {
      totalSpins: wheelStats.totalSpins + 1,
      totalWon: (wheelStats.totalWon || 0) + totalWinnings,
      totalWagered: (wheelStats.totalWagered || 0) + bet,
      biggestWin: Math.max(wheelStats.biggestWin || 0, totalWinnings),
      currentStreak: newStreak,
      highestStreak: highestStreak,
      lastSpins: [...validSpins.slice(-5), {
        time: now,
        bet: bet,
        result: result.label,
        winnings: totalWinnings
      }]
    };
    if (result.type === "jackpot") updatedStats.jackpotsWon = (wheelStats.jackpotsWon || 0) + 1;

    await usersData.set(senderID, {
      money: finalBalance,
      "data.wheelStats": updatedStats
    });

    const resultLines = [
      `🎡 ━━━━━━━ WHEEL RESULT ━━━━━━ 🎡`,
      ``,
      `🎯 SEGMENT: ${result.emoji} ${result.label}`,
      `💰 BET AMOUNT: ${formatMoney(bet)}`,
      `📈 MULTIPLIER: ${result.multiplier.toFixed(2)}x`,
      `━━━━━━━━━━━━━━━━━━━━`
    ];
    if (baseWinnings > 0) resultLines.push(`🎉 BASE WINNINGS: +${formatMoney(baseWinnings)}`);
    if (jackpotWin > 0) resultLines.push(`🏆 JACKPOT BONUS: +${formatMoney(jackpotWin)}!`);
    if (specialEvent) resultLines.push(`✨ SPECIAL EVENT: ${specialEvent.name}!`);
    if (specialBonus > 0) resultLines.push(`🔥 STREAK BONUS (${newStreak}): +${formatMoney(specialBonus)}`);
    if (result.type === "bankrupt") resultLines.push(`💸 BANKRUPT FEE: -${formatMoney(Math.floor(bet * result.fee))}`);
    resultLines.push(
      `━━━━━━━━━━━━━━━━━━━━`,
      `💵 TOTAL WINNINGS: ${totalWinnings > 0 ? '+' : ''}${formatMoney(totalWinnings)}`,
      `💰 NEW BALANCE: ${formatMoney(finalBalance)}`,
      `🎡 SPINS LEFT: ${MAX_PLAYS - validSpins.length}/${MAX_PLAYS}`,
      newStreak > 1 ? `🔥 WIN STREAK: ${newStreak}` : ''
    );

    try {
      await api.editMessage(resultLines.join('\n'), spinMessage.messageID);
      if (result.type === "jackpot") {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await api.sendMessage(`🎊 🎊 🎊 MASSIVE JACKPOT WIN! 🎊 🎊 🎊\nCongratulations! You won ${formatMoney(jackpotWin)} coins!`, threadID);
      } else if (totalWinnings > bet * 3) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await api.sendMessage("🎉 INCREDIBLE WIN! THE WHEEL FAVORS YOU! 🎉", threadID);
      }
    } catch (e) {
      console.error("Failed to edit message:", e);
      await api.sendMessage(resultLines.join('\n'), threadID);
    }
  }
};
