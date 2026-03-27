const axios = require("axios");

async function toFont(text, id = 22) {
  try {
    const GITHUB_RAW = "https://raw.githubusercontent.com/Saim-x69x/sakura/main/ApiUrl.json";
    const rawRes = await axios.get(GITHUB_RAW);
    const apiBase = rawRes.data.apiv1;

    const apiUrl = `${apiBase}/api/font?id=${id}&text=${encodeURIComponent(text)}`;
    const { data } = await axios.get(apiUrl);
    return data.output || text;
  } catch (e) {
    console.error("Erreur API font:", e.message);
    return text;
  }
}

module.exports = {
  config: {
    name: "animequiz",
    aliases: ["animeqz", "aniquiz", "aniqz"],
    version: "1.0",
    author: "Christus",
    countDown: 10,
    role: 0,
    category: "jeu",
    guide: { fr: "{pn} — Devinez le personnage d'anime !" }
  },

  onStart: async function ({ api, event }) {
    try {
      const GITHUB_RAW = "https://raw.githubusercontent.com/Saim-x69x/sakura/main/ApiUrl.json";
      const rawRes = await axios.get(GITHUB_RAW);
      const quizApiBase = rawRes.data.apiv1;

      const { data } = await axios.get(`${quizApiBase}/api/animequiz`);
      const { image, options, answer } = data;

      const imageStream = await axios({ method: "GET", url: image, responseType: "stream" });

      const body = await toFont(`🎌 𝐀𝐧𝐢𝐦𝐞 𝐐𝐮𝐢𝐳 🎭
━━━━━━━━━━━━━━
📷 Devinez le personnage d'anime !

🅐 ${options.A}
🅑 ${options.B}
🅒 ${options.C}
🅓 ${options.D}

⏳ Vous avez 1 minute 30 secondes !
💡 Vous avez 3 essais ! Répondez avec A, B, C ou D.`);

      api.sendMessage(
        { body, attachment: imageStream.data },
        event.threadID,
        async (err, info) => {
          if (err) return console.error(err);

          global.GoatBot.onReply.set(info.messageID, {
            commandName: this.config.name,
            type: "reply",
            messageID: info.messageID,
            author: event.senderID,
            correctAnswer: answer,
            chances: 3,
            answered: false
          });

          setTimeout(async () => {
            const quizData = global.GoatBot.onReply.get(info.messageID);
            if (quizData && !quizData.answered) {
              try { await api.unsendMessage(info.messageID); } catch {}
              global.GoatBot.onReply.delete(info.messageID);
            }
          }, 90000);
        },
        event.messageID
      );
    } catch (err) {
      console.error(err);
      const failMsg = await toFont("❌ Impossible de récupérer les données du quiz d'anime.");
      api.sendMessage(failMsg, event.threadID, event.messageID);
    }
  },

  onReply: async function ({ api, event, Reply, usersData }) {
    let { author, correctAnswer, messageID, chances } = Reply;
    const reply = event.body?.trim().toUpperCase();

    if (event.senderID !== author) {
      const msg = await toFont("⚠️ Ce quiz n'est pas pour vous !");
      return api.sendMessage(msg, event.threadID, event.messageID);
    }

    if (!reply || !["A", "B", "C", "D"].includes(reply)) {
      const msg = await toFont("❌ Répondez avec A, B, C ou D uniquement.");
      return api.sendMessage(msg, event.threadID, event.messageID);
    }

    if (reply === correctAnswer) {
      try { await api.unsendMessage(messageID); } catch {}

      const rewardCoin = 350;
      const rewardExp = 120;
      const userData = (await usersData.get(event.senderID)) || { money: 0, exp: 0 };
      userData.money += rewardCoin;
      userData.exp += rewardExp;
      await usersData.set(event.senderID, userData);

      const correctMsg = await toFont(`🎯 Sugoi ! Vous avez deviné juste !

✅ Bonne réponse !
💰 +${rewardCoin} pièces
🌟 +${rewardExp} EXP

🏆 Vous êtes un vrai fan d'anime !`);

      if (global.GoatBot.onReply.has(messageID)) {
        global.GoatBot.onReply.get(messageID).answered = true;
        global.GoatBot.onReply.delete(messageID);
      }

      return api.sendMessage(correctMsg, event.threadID, event.messageID);
    } else {
      chances--;

      if (chances > 0) {
        global.GoatBot.onReply.set(messageID, { ...Reply, chances });
        const wrongTryMsg = await toFont(`❌ Mauvaise réponse !
⏳ Il vous reste ${chances} chance(s). Essayez encore !`);
        return api.sendMessage(wrongTryMsg, event.threadID, event.messageID);
      } else {
        try { await api.unsendMessage(messageID); } catch {}
        const wrongMsg = await toFont(`😢 Plus de chances !
✅ La bonne réponse était : ${correctAnswer}`);
        return api.sendMessage(wrongMsg, event.threadID, event.messageID);
      }
    }
  }
};
