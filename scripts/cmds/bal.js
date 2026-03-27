const fs = require("fs-extra");
const path = require("path");
const fetch = require("node-fetch");

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

  try {
    const fontsDir = path.join(__dirname, "fonts");
    if (fs.existsSync(fontsDir)) {
      const fontFiles = fs.readdirSync(fontsDir);
      for (const fontFile of fontFiles) {
        if (fontFile.endsWith(".ttf") || fontFile.endsWith(".otf")) {
          const fontPath = path.join(fontsDir, fontFile);
          const fontName = path.basename(fontFile, path.extname(fontFile));
          registerFont(fontPath, { family: fontName });
        }
      }
    }
  } catch (error) {
    console.log("Custom fonts loading error:", error.message);
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

const CONFIG = {
  currency: {
    symbol: "$",
    name: "Dollar",
    decimalPlaces: 2
  },
  transfer: {
    minAmount: 10,
    maxAmount: 1000000,
    taxRates: [
      { max: 1000, rate: 2 },
      { max: 10000, rate: 5 },
      { max: 50000, rate: 8 },
      { max: 100000, rate: 10 },
      { max: 500000, rate: 12 },
      { max: 1000000, rate: 15 }
    ],
    dailyLimit: 500000
  },
  dailyBonus: {
    baseAmount: 100,
    streakMultiplier: 0.1,
    maxStreak: 30,
    resetHours: 21
  },
  card: {
    width: 1000,
    height: 500,
    borderRadius: 30,
    glowIntensity: 25
  },
  tiers: [
    { name: "Starter", min: 0, max: 999, color: "#cd7f32", badge: "🥉", multiplier: 1.0 },
    { name: "Rookie", min: 1000, max: 4999, color: "#c0c0c0", badge: "🥈", multiplier: 1.1 },
    { name: "Pro", min: 5000, max: 19999, color: "#ffd700", badge: "🥇", multiplier: 1.2 },
    { name: "Elite", min: 20000, max: 49999, color: "#e5e4e2", badge: "💎", multiplier: 1.3 },
    { name: "Master", min: 50000, max: 99999, color: "#0ff", badge: "👑", multiplier: 1.5 },
    { name: "Legend", min: 100000, max: 499999, color: "#ff00ff", badge: "🌟", multiplier: 2.0 },
    { name: "God", min: 500000, max: Infinity, color: "#ff0000", badge: "⚡", multiplier: 3.0 }
  ]
};

function formatMoney(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return `${CONFIG.currency.symbol}0`;
  }
  amount = Number(amount);
  if (amount === Infinity) return `${CONFIG.currency.symbol}∞`;
  if (amount === -Infinity) return `${CONFIG.currency.symbol}-∞`;
  if (!isFinite(amount)) return `${CONFIG.currency.symbol}NaN`;
  const scales = [
    { value: 1e18, suffix: "Qi" },
    { value: 1e15, suffix: "Qa" },
    { value: 1e12, suffix: "T" },
    { value: 1e9, suffix: "B" },
    { value: 1e6, suffix: "M" },
    { value: 1e3, suffix: "K" }
  ];
  const scale = scales.find(s => Math.abs(amount) >= s.value);
  if (scale) {
    const scaledValue = amount / scale.value;
    const formatted = Math.abs(scaledValue).toFixed(CONFIG.currency.decimalPlaces);
    const cleanValue = formatted.endsWith(".00") ? formatted.slice(0, -3) : formatted;
    return `${amount < 0 ? "-" : ""}${CONFIG.currency.symbol}${cleanValue}${scale.suffix}`;
  }
  const parts = Math.abs(amount).toFixed(CONFIG.currency.decimalPlaces).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${amount < 0 ? "-" : ""}${CONFIG.currency.symbol}${parts.join(".")}`;
}

function getTierInfo(balance) {
  const validBalance = Number(balance) || 0;
  for (const tier of CONFIG.tiers) {
    if (validBalance >= tier.min && validBalance <= tier.max) {
      return {
        ...tier,
        glow: `${tier.color}80`,
        nextTier: CONFIG.tiers[CONFIG.tiers.indexOf(tier) + 1] || null,
        progress: tier.max === Infinity ? 100 : Math.min(100, ((validBalance - tier.min) / (tier.max - tier.min)) * 100)
      };
    }
  }
  return {
    name: "Unknown",
    color: "#888888",
    badge: "❓",
    multiplier: 1.0,
    glow: "#88888880"
  };
}

function calculateTax(amount) {
  let applicableRate = 0;
  for (const rate of CONFIG.transfer.taxRates) {
    if (amount <= rate.max) {
      applicableRate = rate.rate;
      break;
    }
  }
  if (applicableRate === 0) {
    applicableRate = CONFIG.transfer.taxRates[CONFIG.transfer.taxRates.length - 1].rate;
  }
  const tax = Math.ceil((amount * applicableRate) / 100);
  const total = amount + tax;
  return { rate: applicableRate, tax, total, netAmount: amount };
}

function createRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawBanknote(ctx, x, y, width, height, value, color) {
  ctx.save();
  ctx.fillStyle = color + "20";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = color + "80";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = color + "10";
  for (let i = 0; i < width; i += 20) {
    for (let j = 0; j < height; j += 20) {
      if ((i + j) % 40 === 0) {
        ctx.fillRect(x + i, y + j, 10, 10);
      }
    }
  }
  ctx.fillStyle = color;
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText(formatMoney(value), x + width / 2, y + height / 2 + 5);
  ctx.font = "20px Arial";
  ctx.fillText(CONFIG.currency.symbol, x + width / 2, y + height / 2 - 15);
  ctx.restore();
}

function drawProgressBar(ctx, x, y, width, height, progress, color) {
  ctx.save();
  ctx.fillStyle = "#333333";
  createRoundedRect(ctx, x, y, width, height, height / 2);
  ctx.fill();
  const progressWidth = Math.max(5, (progress / 100) * width);
  ctx.fillStyle = color;
  createRoundedRect(ctx, x, y, progressWidth, height, height / 2);
  ctx.fill();
  ctx.strokeStyle = "#555555";
  ctx.lineWidth = 1;
  createRoundedRect(ctx, x, y, width, height, height / 2);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(progress)}%`, x + width / 2, y + height / 2 + 4);
  ctx.restore();
}

async function loadUserAvatar(usersData, targetID) {
  try {
    const avatarURL = await usersData.getAvatarUrl(targetID);
    if (!avatarURL) return null;
    const response = await fetch(avatarURL);
    if (!response.ok) return null;
    const buffer = await response.buffer();
    if (buffer.length < 100) return null;
    return await loadImage(buffer);
  } catch (error) {
    console.log("Avatar load error:", error.message);
    return null;
  }
}

function generateTransactionID() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `TX${timestamp}${random}`.toUpperCase();
}

let fonts;
try {
  fonts = require('../../func/font.js');
} catch (error) {
  console.log("Fonts module not found, using fallback");
}

module.exports = {
  config: {
    name: "balance",
    aliases: ["bal", "$", "cash"],
    version: "6.0",
    author: "Christus",
    countDown: 3,
    role: 0,
    description: canvasAvailable ? "💰 Système économique stylé avec cartes premium" : "💰 Système économique (mode texte)",
    category: "economy",
    guide: {
      fr: canvasAvailable ?
        "{pn} - voir ton solde\n{pn} @utilisateur - voir le solde d'un autre\n{pn} t @utilisateur montant - transférer de l'argent\n{pn} theme [nom] - changer de thème\n{pn} daily - bonus quotidien\n{pn} top [page] - classement\n{pn} rank - ton rang" :
        "{pn} - voir ton solde\n{pn} @utilisateur - voir le solde d'un autre\n{pn} t @utilisateur montant - transférer de l'argent\n{pn} daily - bonus quotidien\n{pn} top [page] - classement\n{pn} rank - ton rang"
    }
  },

  onStart: async function ({ message, event, args, usersData, api }) {
    const { senderID, mentions, messageReply, threadID } = event;
    const command = args[0]?.toLowerCase();

    if (command === "daily") {
      const userData = await usersData.get(senderID);
      const now = Date.now();
      const lastDaily = userData.lastDaily || 0;
      const dailyStreak = userData.dailyStreak || 0;
      const hoursSinceLast = (now - lastDaily) / (1000 * 60 * 60);
      if (hoursSinceLast < CONFIG.dailyBonus.resetHours) {
        const hoursLeft = Math.ceil(CONFIG.dailyBonus.resetHours - hoursSinceLast);
        const response = `⏰ Vous avez déjà réclamé votre bonus quotidien aujourd'hui !\n🔄 Prochain bonus dans ${hoursLeft} heures\n🔥 Streak actuel : ${dailyStreak} jours`;
        return message.reply(fonts?.bold ? fonts.bold(response) : response);
      }
      const baseBonus = CONFIG.dailyBonus.baseAmount;
      const streakBonus = Math.min(dailyStreak * CONFIG.dailyBonus.streakMultiplier * baseBonus, baseBonus * 5);
      const totalBonus = Math.round(baseBonus + streakBonus);
      const newStreak = hoursSinceLast < CONFIG.dailyBonus.resetHours * 2 ? dailyStreak + 1 : 1;
      await usersData.set(senderID, {
        money: (userData.money || 0) + totalBonus,
        lastDaily: now,
        dailyStreak: newStreak
      });
      const bonusMessage = `
🎉 BONUS QUOTIDIEN ! 🎉

💰 Bonus de base : ${formatMoney(baseBonus)}
🔥 Bonus de streak : ${formatMoney(streakBonus)}
🎁 Total reçu : ${formatMoney(totalBonus)}

📈 Nouveau streak : ${newStreak} jour${newStreak !== 1 ? 's' : ''}
💸 Nouveau solde : ${formatMoney((userData.money || 0) + totalBonus)}

💡 Revenez demain pour un bonus plus grand !
      `.trim();
      return message.reply(fonts?.bold ? fonts.bold(bonusMessage) : bonusMessage);
    }

    if (command === "rank") {
      const userData = await usersData.get(senderID);
      const balance = userData.money || 0;
      const tierInfo = getTierInfo(balance);
      const allUsers = await usersData.getAll();
      const sortedUsers = allUsers.sort((a, b) => (b.money || 0) - (a.money || 0));
      const globalRank = sortedUsers.findIndex(user => user.userID === senderID) + 1;
      const totalUsers = sortedUsers.length;
      const rankMessage = `
🏆 INFORMATION DE RANG

👤 Joueur : ${userData.name || "Utilisateur"}
💰 Solde : ${formatMoney(balance)}
🥇 Rang : ${tierInfo.badge} ${tierInfo.name}
📊 Classement global : #${globalRank} sur ${totalUsers}
📈 Progression vers le prochain rang : ${tierInfo.progress.toFixed(1)}%

💡 Prochain rang : ${tierInfo.nextTier ? `${tierInfo.nextTier.badge} ${tierInfo.nextTier.name}` : 'RANG MAX'}
🎯 Nécessaire : ${tierInfo.nextTier ? formatMoney(tierInfo.nextTier.min - balance) : 'N/A'}

💎 Multiplicateur de rang : ${tierInfo.multiplier}x
      `.trim();
      return message.reply(fonts?.bold ? fonts.bold(rankMessage) : rankMessage);
    }

    if (command === "top") {
      const page = parseInt(args[1]) || 1;
      const perPage = 10;
      const allUsers = await usersData.getAll();
      const wealthyUsers = allUsers.filter(user => user.money > 0).sort((a, b) => (b.money || 0) - (a.money || 0));
      const totalPages = Math.ceil(wealthyUsers.length / perPage);
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const pageUsers = wealthyUsers.slice(startIndex, endIndex);
      if (pageUsers.length === 0) {
        const msg = "📭 Aucun utilisateur sur cette page !";
        return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
      }
      let leaderboardText = `🏆 CLASSEMENT DES RICHES (Page ${page}/${totalPages}) 🏆\n\n`;
      pageUsers.forEach((user, index) => {
        const globalRank = startIndex + index + 1;
        const rankEmoji = ["🥇", "🥈", "🥉"][globalRank - 1] || `🏅`;
        const name = user.name || "Inconnu";
        const money = user.money || 0;
        const tier = getTierInfo(money);
        leaderboardText += `${rankEmoji} #${globalRank}. ${name}\n`;
        leaderboardText += `   💰 ${formatMoney(money)} | ${tier.badge} ${tier.name}\n`;
        leaderboardText += `   ───────────────\n`;
      });
      if (totalPages > 1) {
        leaderboardText += `\n📖 Utilisez : !balance top <page> pour naviguer`;
        leaderboardText += `\n👤 Votre position : #${wealthyUsers.findIndex(u => u.userID === senderID) + 1}`;
      }
      return message.reply(fonts?.bold ? fonts.bold(leaderboardText) : leaderboardText);
    }

    if (command === "transfer" || command === "send" || command === "pay" || command === "t") {
      let targetID = Object.keys(mentions)[0] || messageReply?.senderID || args[1];
      const amountRaw = args.find(a => !isNaN(parseFloat(a)) && parseFloat(a) > 0);
      const amount = parseFloat(amountRaw);
      if (!targetID || isNaN(amount)) {
        const usage = `
💸 Utilisation du transfert :
!balance transfer @utilisateur montant
Exemple : !bal transfer @John 1000

📊 Taux de taxe :
• ≤ $1,000 : 2%
• ≤ $10,000 : 5%
• ≤ $50,000 : 8%
• ≤ $100,000 : 10%
• ≤ $500,000 : 12%
• > $500,000 : 15%
        `.trim();
        return message.reply(fonts?.bold ? fonts.bold(usage) : usage);
      }
      if (targetID === senderID) {
        const msg = "❌ Vous ne pouvez pas vous envoyer de l'argent à vous-même.";
        return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
      }
      if (amount < CONFIG.transfer.minAmount) {
        const msg = `❌ Le montant minimum de transfert est ${formatMoney(CONFIG.transfer.minAmount)}.`;
        return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
      }
      if (amount > CONFIG.transfer.maxAmount) {
        const msg = `❌ Le montant maximum de transfert est ${formatMoney(CONFIG.transfer.maxAmount)}.`;
        return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
      }
      const [sender, receiver] = await Promise.all([
        usersData.get(senderID),
        usersData.get(targetID)
      ]);
      if (!receiver) {
        const msg = "❌ Utilisateur cible introuvable dans la base de données.";
        return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
      }
      const taxInfo = calculateTax(amount);
      if ((sender.money || 0) < taxInfo.total) {
        const needed = taxInfo.total - (sender.money || 0);
        const msg = `
❌ Fonds insuffisants !

💵 Montant à envoyer : ${formatMoney(amount)}
🏛️ Taxe (${taxInfo.rate}%) : ${formatMoney(taxInfo.tax)}
💸 Total nécessaire : ${formatMoney(taxInfo.total)}
💰 Votre solde : ${formatMoney(sender.money || 0)}
📉 Manque : ${formatMoney(needed)}
        `.trim();
        return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
      }
      await Promise.all([
        usersData.set(senderID, { money: (sender.money || 0) - taxInfo.total }),
        usersData.set(targetID, { money: (receiver.money || 0) + amount })
      ]);
      const [senderName, receiverName] = await Promise.all([
        usersData.getName(senderID),
        usersData.getName(targetID)
      ]);
      const transactionID = generateTransactionID();
      const successMessage = `
✅ TRANSFERT RÉUSSI ! 💸
━━━━━━━━━━━━━━━━━━━━
📋 ID Transaction : ${transactionID}
👤 De : ${senderName}
🎯 Vers : ${receiverName}
━━━━━━━━━━━━━━━━━━━━
💰 Montant envoyé : ${formatMoney(amount)}
🏛️ Taxe déduite : ${formatMoney(taxInfo.tax)} (${taxInfo.rate}%)
💸 Total débité : ${formatMoney(taxInfo.total)}
━━━━━━━━━━━━━━━━━━━━
📊 Nouveau solde expéditeur : ${formatMoney((sender.money || 0) - taxInfo.total)}
💳 Nouveau solde destinataire : ${formatMoney((receiver.money || 0) + amount)}
━━━━━━━━━━━━━━━━━━━━
⏰ Heure : ${new Date().toLocaleTimeString()}
✅ Statut : Vérifié et sécurisé
      `.trim();
      return message.reply(fonts?.bold ? fonts.bold(successMessage) : successMessage);
    }

    const themeNames = ["emerald", "royal", "ocean", "sunset", "neon"];
    let selectedTheme = "emerald";
    const userDataTheme = await usersData.get(senderID);
    if (userDataTheme?.data?.balanceTheme && themeNames.includes(userDataTheme.data.balanceTheme)) {
      selectedTheme = userDataTheme.data.balanceTheme;
    }
    if (command === "theme") {
      if (args[1] && themeNames.includes(args[1].toLowerCase())) {
        selectedTheme = args[1].toLowerCase();
        await usersData.set(senderID, {
          ...userDataTheme,
          data: { ...(userDataTheme.data || {}), balanceTheme: selectedTheme }
        });
        const msg = `🎨 Thème changé pour : ${balanceThemes[selectedTheme].name}`;
        return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
      } else {
        const msg = `🎨 Thèmes disponibles :\n${themeNames.map(t => `• ${balanceThemes[t].name}`).join('\n')}`;
        return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
      }
    }

    let targetID = senderID;
    if (Object.keys(mentions).length > 0) targetID = Object.keys(mentions)[0];
    else if (messageReply) targetID = messageReply.senderID;

    const [userData, allUsers] = await Promise.all([
      usersData.get(targetID),
      usersData.getAll()
    ]);
    if (!userData) {
      const msg = "❌ Utilisateur introuvable.";
      return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
    }
    const userName = userData.name || "Utilisateur";
    const balance = userData.money || 0;
    const tierInfo = getTierInfo(balance);
    const sortedUsers = allUsers.sort((a, b) => (b.money || 0) - (a.money || 0));
    const globalRank = sortedUsers.findIndex(user => user.userID === targetID) + 1;
    const totalUsers = sortedUsers.length;
    const percentile = ((totalUsers - globalRank) / totalUsers * 100).toFixed(1);

    let avatarImage = null;
    if (canvasAvailable) {
      try {
        avatarImage = await loadUserAvatar(usersData, targetID);
      } catch (error) {
        console.log("Avatar load failed, using fallback");
      }
    }

    if (!canvasAvailable) {
      const fallbackMessage = `
💳 Information du compte

👤 Utilisateur : ${userName}
💰 Solde : ${formatMoney(balance)}
🏆 Rang : ${tierInfo.name} ${tierInfo.badge}
📊 Classement : #${globalRank} sur ${totalUsers}
🎯 Progression : ${tierInfo.progress.toFixed(1)}% vers le prochain rang

💡 Commandes :
• !balance daily - Bonus quotidien
• !balance transfer - Envoyer de l'argent
• !balance top - Classement
      `.trim();
      return message.reply(fonts?.bold ? fonts.bold(fallbackMessage) : fallbackMessage);
    }

    const canvas = createCanvas(CONFIG.card.width, CONFIG.card.height);
    const ctx = canvas.getContext("2d");

    const bgGradient = ctx.createLinearGradient(0, 0, CONFIG.card.width, CONFIG.card.height);
    bgGradient.addColorStop(0, "#0a0a1f");
    bgGradient.addColorStop(0.5, "#151530");
    bgGradient.addColorStop(1, "#0f0f23");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CONFIG.card.width, CONFIG.card.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
    for (let i = 0; i < 100; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * CONFIG.card.width, Math.random() * CONFIG.card.height, Math.random() * 2 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const card = {
      x: 40,
      y: 30,
      width: CONFIG.card.width - 80,
      height: CONFIG.card.height - 60
    };
    ctx.save();
    createRoundedRect(ctx, card.x, card.y, card.width, card.height, CONFIG.card.borderRadius);
    ctx.clip();
    const cardGradient = ctx.createLinearGradient(card.x, card.y, card.x, card.y + card.height);
    cardGradient.addColorStop(0, "rgba(255, 255, 255, 0.05)");
    cardGradient.addColorStop(1, "rgba(255, 255, 255, 0.02)");
    ctx.fillStyle = cardGradient;
    ctx.fillRect(card.x, card.y, card.width, card.height);
    ctx.restore();

    ctx.strokeStyle = tierInfo.color;
    ctx.lineWidth = 4;
    ctx.shadowColor = tierInfo.color;
    ctx.shadowBlur = CONFIG.card.glowIntensity;
    createRoundedRect(ctx, card.x, card.y, card.width, card.height, CONFIG.card.borderRadius);
    ctx.stroke();
    ctx.shadowBlur = 0;

    try {
      ctx.font = `bold 32px BeVietnamPro-Bold, Arial, sans-serif`;
    } catch {
      ctx.font = "bold 32px Arial";
    }
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText("💳 PASSEPORT FINANCIER", card.x + 40, card.y + 50);

    ctx.fillStyle = tierInfo.color;
    try {
      ctx.font = `bold 56px BeVietnamPro-Bold, Arial, sans-serif`;
    } catch {
      ctx.font = "bold 56px Arial";
    }
    ctx.textAlign = "center";
    ctx.shadowColor = tierInfo.color;
    ctx.shadowBlur = 20;
    ctx.fillText(formatMoney(balance), card.x + card.width / 2, card.y + 120);
    ctx.shadowBlur = 0;

    const infoX = card.x + 40;
    const infoY = card.y + 160;
    try {
      ctx.font = `bold 24px BeVietnamPro-Bold, Arial, sans-serif`;
    } catch {
      ctx.font = "bold 24px Arial";
    }
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.fillText(`👤 ${userName}`, infoX, infoY);
    try {
      ctx.font = `16px BeVietnamPro-Regular, Arial, sans-serif`;
    } catch {
      ctx.font = "16px Arial";
    }
    ctx.fillStyle = "#aaaaaa";
    ctx.fillText(`🆔 ${targetID}`, infoX, infoY + 30);
    ctx.fillStyle = "#ffaa00";
    try {
      ctx.font = `bold 18px BeVietnamPro-Bold, Arial, sans-serif`;
    } catch {
      ctx.font = "bold 18px Arial";
    }
    ctx.fillText(`🏆 Classement global : #${globalRank} (Top ${percentile}%)`, infoX, infoY + 60);
    ctx.fillStyle = tierInfo.color;
    try {
      ctx.font = `bold 20px BeVietnamPro-Bold, Arial, sans-serif`;
    } catch {
      ctx.font = "bold 20px Arial";
    }
    ctx.fillText(`${tierInfo.badge} ${tierInfo.name}`, infoX, infoY + 90);

    if (tierInfo.nextTier) {
      const progressBarX = infoX;
      const progressBarY = infoY + 100;
      const progressBarWidth = 300;
      const progressBarHeight = 20;
      drawProgressBar(ctx, progressBarX, progressBarY, progressBarWidth, progressBarHeight, tierInfo.progress, tierInfo.color);
      try {
        ctx.font = `14px BeVietnamPro-Regular, Arial, sans-serif`;
      } catch {
        ctx.font = "14px Arial";
      }
      ctx.fillStyle = "#aaaaaa";
      ctx.fillText(`Prochain : ${tierInfo.nextTier.name} (${formatMoney(tierInfo.nextTier.min - balance)} restant)`, progressBarX, progressBarY + 100);
    }

    const avatarX = card.x + card.width - 180;
    const avatarY = card.y + 150;
    const avatarSize = 150;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fill();
    ctx.strokeStyle = tierInfo.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    if (avatarImage) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 - 2, 0, Math.PI * 2);
      ctx.fillStyle = tierInfo.color + "40";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      try {
        ctx.font = `bold 14px BeVietnamPro-Bold, Arial, sans-serif`;
      } catch {
        ctx.font = "bold 14px Arial";
      }
      ctx.textAlign = "center";
      ctx.fillText("AVATAR", avatarX + avatarSize/2, avatarY + avatarSize/2 + 5);
      ctx.restore();
    }

    const notesY = card.y + 300;
    const noteWidth = 80;
    const noteHeight = 40;
    const noteSpacing = 20;
    const denominations = [1000, 100, 10, 1];
    let noteX = card.x + 40;
    for (const denom of denominations) {
      const noteCount = Math.floor(balance / denom);
      if (noteCount > 0) {
        drawBanknote(ctx, noteX, notesY, noteWidth, noteHeight, denom, tierInfo.color);
        noteX += noteWidth + noteSpacing;
      }
    }

    try {
      ctx.font = `12px BeVietnamPro-Regular, Arial, sans-serif`;
    } catch {
      ctx.font = "12px Arial";
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.textAlign = "left";
    ctx.fillText("🏦 Système bancaire sécurisé • Transactions cryptées", card.x + 40, card.y + card.height - 20);
    ctx.textAlign = "right";
    ctx.fillText("© Christus", card.x + card.width - 40, card.y + card.height - 20);

    const tmpDir = path.join(__dirname, "cache");
    if (!fs.existsSync(tmpDir)) {
      fs.ensureDirSync(tmpDir);
    }
    const filePath = path.join(tmpDir, `balance_${targetID}_${Date.now()}.png`);
    fs.writeFileSync(filePath, canvas.toBuffer("image/png"));

    const responseBody = fonts?.bold ?
      fonts.bold(`💎 ${balanceThemes[selectedTheme].name} 💎\n💰 Solde de ${userName} : ${formatMoney(balance)}`) :
      `💎 ${balanceThemes[selectedTheme].name} 💎\n💰 Solde de ${userName} : ${formatMoney(balance)}`;

    await message.reply({
      body: responseBody,
      attachment: fs.createReadStream(filePath)
    }, () => {
      fs.unlinkSync(filePath);
    });
  }
};

const balanceThemes = {
  emerald: {
    name: "Émeraude Royale",
    background: (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#0f2027");
      gradient.addColorStop(0.5, "#203a43");
      gradient.addColorStop(1, "#2c5364");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255, 215, 0, 0.1)";
      ctx.lineWidth = 2;
      for (let i = 0; i < width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + height, height);
        ctx.stroke();
      }
    },
    primaryColor: "#FFD700",
    secondaryColor: "#00FF7F",
    textColor: "#FFFFFF",
    accentColor: "#FF69B4",
    cardBg: "rgba(255,255,255,0.08)"
  },
  royal: {
    name: "Pourpre Royal",
    background: (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#2b0a3d");
      gradient.addColorStop(0.5, "#4a1e6b");
      gradient.addColorStop(1, "#6b2d8c");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255, 215, 0, 0.05)";
      for (let i = 0; i < 50; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    primaryColor: "#FFD700",
    secondaryColor: "#FF69B4",
    textColor: "#FFFFFF",
    accentColor: "#9370DB",
    cardBg: "rgba(255,255,255,0.1)"
  },
  ocean: {
    name: "Océan Profond",
    background: (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#005AA7");
      gradient.addColorStop(0.5, "#0077BE");
      gradient.addColorStop(1, "#00BFFF");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(0, height * 0.7 + i * 20);
        for (let x = 0; x < width; x += 20) {
          ctx.lineTo(x, height * 0.7 + i * 20 + Math.sin(x * 0.05) * 10);
        }
        ctx.stroke();
      }
    },
    primaryColor: "#FFD700",
    secondaryColor: "#40E0D0",
    textColor: "#FFFFFF",
    accentColor: "#FF69B4",
    cardBg: "rgba(255,255,255,0.1)"
  },
  sunset: {
    name: "Coucher de Soleil",
    background: (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "#FF416C");
      gradient.addColorStop(0.5, "#FF4B2B");
      gradient.addColorStop(1, "#FF8C00");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.arc(100 + i * 80, 80, 40, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    primaryColor: "#FFFFFF",
    secondaryColor: "#FFD700",
    textColor: "#FFFFFF",
    accentColor: "#FF69B4",
    cardBg: "rgba(0,0,0,0.2)"
  },
  neon: {
    name: "Néon City",
    background: (ctx, width, height) => {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(0, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let i = 0; i < height; i += 30) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }
    },
    primaryColor: "#00FFFF",
    secondaryColor: "#FF00FF",
    textColor: "#FFFFFF",
    accentColor: "#FFFF00",
    cardBg: "rgba(255,255,255,0.05)"
  }
};