const axios = require('axios');

const BASE_URL = 'https://qizapi.onrender.com/api';

// Fonction de traduction (MyMemory)
async function translateToFrench(text) {
  if (!text) return text;
  try {
    const { data } = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|fr`);
    if (data.responseStatus === 200 && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
  } catch (e) {
    console.error("Erreur traduction:", e.message);
  }
  return text; // fallback
}

module.exports = {
  config: {
    name: "quiz",
    aliases: ["qz"],
    version: "3.0",
    author: "Christus",
    team: "NoobCore",
    countDown: 0,
    role: 0,
    guide: {
      en: "{pn} <category> — Start a quiz in the chosen category.",
      fr: "{pn} <catégorie> — Lance un quiz dans la catégorie choisie."
    }
  },

  generateProgressBar(percentile) {
    const filled = Math.round(percentile / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  },

  getUserTitle(correct) {
    if (correct >= 50000) return '🌟 Quiz Omniscient';
    if (correct >= 25000) return '👑 Quiz Divin';
    if (correct >= 15000) return '⚡ Titan du Quiz';
    if (correct >= 10000) return '🏆 Légende du Quiz';
    if (correct >= 7500) return '🎓 Grand Maître';
    if (correct >= 5000) return '👨‍🎓 Maître du Quiz';
    if (correct >= 2500) return '🔥 Expert en Quiz';
    if (correct >= 1500) return '📚 Savant du Quiz';
    if (correct >= 1000) return '🎯 Apprenti Quiz';
    if (correct >= 750) return '🌟 Chercheur de Savoir';
    if (correct >= 500) return '📖 Apprentissage Rapide';
    if (correct >= 250) return '🚀 Étoile Montante';
    if (correct >= 100) return '💡 Débutant Prometteur';
    if (correct >= 50) return '🎪 Premiers Pas';
    if (correct >= 25) return '🌱 Nouveau Venu';
    if (correct >= 10) return '🔰 Apprenti';
    if (correct >= 1) return '👶 Recrue';
    return '🆕 Nouveau Joueur';
  },

  async getUserName(api, userId) {
    try {
      const userInfo = await api.getUserInfo(userId);
      return userInfo[userId]?.name || 'Joueur Anonyme';
    } catch {
      return 'Joueur Anonyme';
    }
  },

  async getAvailableCategories() {
    try {
      const res = await axios.get(`${BASE_URL}/categories`);
      return res.data.map(cat => cat.toLowerCase());
    } catch {
      return [];
    }
  },

  ncStart: async function ({ api, event, args, usersData }) {
    const { threadID, messageID, senderID } = event;
    const command = args[0]?.toLowerCase();

    try {
      if (!args[0] || command === "help") {
        return await this.handleDefaultView(api, threadID, messageID);
      }

      switch (command) {
        case "rank":
        case "profile":
          return await this.handleRank(api, threadID, messageID, senderID, usersData);
        case "leaderboard":
        case "lb":
          return await this.handleLeaderboard(api, threadID, messageID, args.slice(1));
        case "category":
          if (args.length > 1) {
            return await this.handleCategoryLeaderboard(api, threadID, messageID, args.slice(1));
          }
          return await this.handleCategories(api, threadID, messageID);
        case "daily":
          return await this.handleDailyChallenge(api, threadID, messageID, senderID, this.config.name);
        case "torf":
          return await this.handleTrueOrFalse(api, threadID, messageID, senderID, this.config.name);
        case "flag":
          return await this.handleFlagQuiz(api, threadID, messageID, senderID, this.config.name);
        case "anime":
          return await this.handleAnimeQuiz(api, threadID, messageID, senderID, this.config.name);
        case "hard":
          return await this.handleQuiz(api, threadID, messageID, senderID, ["general"], this.config.name, "hard", usersData);
        case "medium":
          return await this.handleQuiz(api, threadID, messageID, senderID, ["general"], this.config.name, "medium", usersData);
        case "easy":
          return await this.handleQuiz(api, threadID, messageID, senderID, ["general"], this.config.name, "easy", usersData);
        case "random":
          return await this.handleQuiz(api, threadID, messageID, senderID, [], this.config.name, null, usersData);
        default:
          const categories = await this.getAvailableCategories();
          if (categories.includes(command)) {
            return await this.handleQuiz(api, threadID, messageID, senderID, [command], this.config.name, null, usersData);
          } else {
            return await this.handleDefaultView(api, threadID, messageID);
          }
      }
    } catch (err) {
      console.error("Erreur dans ncStart:", err);
      return api.sendMessage("⚠️ Une erreur est survenue, réessaye plus tard.", threadID, messageID);
    }
  },

  ncReply: async function ({ api, event, Reply, usersData }) {
    if (Reply.author !== event.senderID) return;

    try {
      const ans = event.body.trim().toUpperCase();
      if (!["A", "B", "C", "D"].includes(ans)) {
        return api.sendMessage("❌ Réponds uniquement avec A, B, C ou D.", event.threadID, event.messageID);
      }

      const timeSpent = (Date.now() - Reply.startTime) / 1000;
      if (timeSpent > 30) {
        return api.sendMessage("⏰ Temps écoulé !", event.threadID, event.messageID);
      }

      const userName = await this.getUserName(api, event.senderID);

      let correctAnswer = Reply.answer;
      let userAnswer = ans;

      if ((Reply.isFlag || Reply.isAnime) && Reply.options) {
        const optionIndex = ans.charCodeAt(0) - 65;
        if (optionIndex >= 0 && optionIndex < Reply.options.length) {
          userAnswer = Reply.options[optionIndex];
        }
      }

      const answerData = {
        userId: event.senderID,
        questionId: Reply.questionId,
        answer: userAnswer,
        timeSpent,
        userName
      };

      const res = await axios.post(`${BASE_URL}/answer`, answerData);
      if (!res.data) throw new Error('Pas de réponse de l\'API');

      const { result, user } = res.data;
      let responseMsg;

      if (result === "correct") {
        const userData = await usersData.get(event.senderID) || {};

        let baseMoneyReward = 10000;
        if (Reply.difficulty === 'hard') baseMoneyReward = 15000;
        if (Reply.difficulty === 'easy') baseMoneyReward = 7500;
        if (Reply.isFlag) baseMoneyReward = 12000;
        if (Reply.isAnime) baseMoneyReward = 15000;
        if (Reply.isDailyChallenge) baseMoneyReward = 20000;

        const streakBonus = (user.currentStreak || 0) * 1000;
        const totalMoneyReward = baseMoneyReward + streakBonus;

        userData.money = (userData.money || 0) + totalMoneyReward;
        await usersData.set(event.senderID, userData);

        const difficultyBonus = Reply.difficulty === 'hard' ? ' 🔥' : Reply.difficulty === 'easy' ? ' ⭐' : '';
        const streakBonus2 = (user.currentStreak || 0) >= 5 ? ` 🚀 x${user.currentStreak} série !` : '';
        const flagBonus = Reply.isFlag ? ' 🏁' : '';
        const animeBonus = Reply.isAnime ? ' 🎌' : '';
        const dailyBonus = Reply.isDailyChallenge ? ' 🌟' : '';

        responseMsg = `🎉 Bonne réponse !\n` +
          `💵 Argent : +${totalMoneyReward.toLocaleString()}\n` +
          `✨ XP : +${user.xpGained || 15}\n` +
          `📊 Score : ${user.correct || 0}/${user.total || 0} (${user.accuracy || 0}%)\n` +
          `🔥 Série : ${user.currentStreak || 0}\n` +
          `⚡ Temps : ${timeSpent.toFixed(1)}s\n` +
          `🎯 Progression XP : ${user.xp || 0}/1000\n` +
          `👤 ${userName}` + difficultyBonus + streakBonus2 + flagBonus + animeBonus + dailyBonus;
      } else {
        responseMsg = `❌ Mauvaise réponse ! Bonne réponse : ${correctAnswer}\n` +
          `📊 Score : ${user.correct || 0}/${user.total || 0} (${user.accuracy || 0}%)\n` +
          `💔 Série réinitialisée\n` +
          `👤 ${userName}` + (Reply.isFlag ? ' 🏁' : '') + (Reply.isAnime ? ' 🎌' : '');
      }

      await api.sendMessage(responseMsg, event.threadID, event.messageID);

      if (user.achievements && user.achievements.length > 0) {
        const achievementMsg = user.achievements.map(ach => `🏆 ${ach}`).join('\n');
        await api.sendMessage(
          `🏆 Succès débloqué !\n${achievementMsg}\n💰 +50 000 pièces bonus !\n✨ +100 XP bonus !`,
          event.threadID
        );

        const userData = await usersData.get(event.senderID) || {};
        userData.money = (userData.money || 0) + 50000;
        await usersData.set(event.senderID, userData);
      }

      try { await api.unsendMessage(Reply.messageID); } catch (e) {}
      global.noobCore.ncReply.delete(Reply.messageID);
    } catch (err) {
      console.error("Erreur dans ncReply:", err);
      const errorMsg = err.response?.data?.error || err.message || "Erreur inconnue";
      api.sendMessage(`⚠️ Erreur lors du traitement : ${errorMsg}`, event.threadID, event.messageID);
    }
  },

  ncReaction: async function ({ api, event, Reaction, usersData }) {
    if (event.userID !== Reaction.author || Reaction.reacted) return;

    try {
      const userAnswer = event.reaction === '😆' ? "A" : "B";
      const isCorrect = userAnswer === Reaction.answer;

      const timeSpent = (Date.now() - Reaction.startTime) / 1000;
      if (timeSpent > 30) {
        return api.sendMessage("⏰ Temps écoulé !", event.threadID, event.messageID);
      }

      const userName = await this.getUserName(api, event.userID);

      const answerData = {
        userId: event.userID,
        questionId: Reaction.questionId,
        answer: userAnswer,
        timeSpent,
        userName
      };

      const res = await axios.post(`${BASE_URL}/answer`, answerData);
      const { user, xpGained } = res.data;

      const userData = await usersData.get(event.userID) || {};
      if (isCorrect) {
        const baseMoneyReward = 10000;
        const streakBonus = (user.currentStreak || 0) * 1000;
        const totalMoneyReward = baseMoneyReward + streakBonus;

        userData.money = (userData.money || 0) + totalMoneyReward;
        await usersData.set(event.userID, userData);

        const correctText = Reaction.answer === "A" ? "Vrai" : "Faux";

        const successMsg = `🎉 Bravo ! Bonne réponse !\n` +
          `━━━━━━━━━\n\n` +
          `💰 Argent gagné : +${totalMoneyReward.toLocaleString()} 💎\n` +
          `✨ XP gagné : +${xpGained || 15} ⚡\n` +
          `🔥 Série : ${user.currentStreak || 0} 🚀\n` +
          `⏱️ Temps : ${timeSpent.toFixed(1)}s\n\n` +
          `🎯 Continue comme ça ! 🌟`;
        api.sendMessage(successMsg, event.threadID, event.messageID);
      } else {
        const correctText = Reaction.answer === "A" ? "Vrai" : "Faux";
        api.sendMessage(
          `❌ Mauvaise réponse ! Bonne réponse : ${correctText} ✅\n` +
          `💔 Série réinitialisée\n` +
          `👤 ${userName}`,
          event.threadID,
          event.messageID
        );
      }

      Reaction.reacted = true;
      setTimeout(() => global.noobCore.ncReaction.delete(Reaction.messageID), 1000);
    } catch (err) {
      console.error("Erreur dans ncReaction:", err);
    }
  },

  async handleDefaultView(api, threadID, messageID) {
    try {
      const res = await axios.get(`${BASE_URL}/categories`);
      const categories = res.data;
      const catText = categories.map(c => `📍 ${c.charAt(0).toUpperCase() + c.slice(1)}`).join("\n");

      return api.sendMessage(
        `🎯 𝗤𝘂𝗶𝘇\n━━━━━━━━\n\n` +
        `📚 𝗖𝗮𝘁é𝗴𝗼𝗿𝗶𝗲𝘀\n\n${catText}\n\n` +
        `━━━━━━━━━\n\n` +
        `🏆 Utilisation\n` +
        `• quiz rank - Voir ton profil\n` +
        `• quiz leaderboard - Classement global\n` +
        `• quiz torf - Vrai/Faux (réagis avec 😆 ou 😮)\n` +
        `• quiz flag - Devine le drapeau\n` +
        `• quiz anime - Devine le personnage d’anime\n\n` +
        `🎮 Utilise : quiz <catégorie> pour commencer`,
        threadID,
        messageID
      );
    } catch {
      return api.sendMessage("⚠️ Impossible de charger les catégories. Essaie 'quiz help' pour les commandes.", threadID, messageID);
    }
  },

  async handleRank(api, threadID, messageID, senderID, usersData) {
    try {
      const userName = await this.getUserName(api, senderID);
      await axios.post(`${BASE_URL}/user/update`, { userId: senderID, name: userName });

      const res = await axios.get(`${BASE_URL}/user/${senderID}`);
      const user = res.data;

      if (!user || user.total === 0) {
        return api.sendMessage(`❌ Tu n'as encore joué à aucun quiz ! Utilise 'quiz random' pour commencer.\n👤 Bienvenue, ${userName} !`, threadID, messageID);
      }

      const position = user.position ?? "N/A";
      const totalUser = user.totalUsers ?? "N/A";
      const progressBar = this.generateProgressBar(user.percentile ?? 0);
      const title = this.getUserTitle(user.correct || 0);
      const streakInfo = user.currentStreak > 0 ? `🔥 Série actuelle : ${user.currentStreak}${user.currentStreak >= 5 ? ' 🚀' : ''}` : `🔥 Série actuelle : 0`;
      const bestStreakInfo = user.bestStreak > 0 ? `🏅 Meilleure série : ${user.bestStreak}${user.bestStreak >= 10 ? ' 👑' : user.bestStreak >= 5 ? ' ⭐' : ''}` : `🏅 Meilleure série : 0`;
      const userData = await usersData.get(senderID) || {};
      const userMoney = userData.money || 0;
      const currentXP = user.xp ?? 0;
      const xpTo1000 = Math.max(0, 1000 - currentXP);
      const xpProgress = Math.min(100, (currentXP / 1000) * 100);
      const xpProgressBar = this.generateProgressBar(xpProgress);

      return api.sendMessage(
        `🎮 𝗣𝗿𝗼𝗳𝗶𝗹 𝗤𝘂𝗶𝘇\n━━━━━━━━━\n\n` +
        `👤 ${userName}\n` +
        `🎖️ ${title}\n` +
        `🏆 Rang global : #${position}/${totalUser}\n` +
        `📈 Percentile : ${progressBar} ${user.percentile ?? 0}%\n\n` +
        `📊 𝗦𝘁𝗮𝘁𝗶𝘀𝘁𝗶𝗾𝘂𝗲𝘀\n` +
        `✅ Bonnes : ${user.correct ?? 0}\n` +
        `❌ Mauvaises : ${user.wrong ?? 0}\n` +
        `📝 Total : ${user.total ?? 0}\n` +
        `🎯 Précision : ${user.accuracy ?? 0}%\n` +
        `⚡ Temps moyen : ${(user.avgResponseTime ?? 0).toFixed(1)}s\n\n` +
        `💰 𝗥𝗶𝗰𝗵𝗲𝘀𝘀𝗲 & 𝗫𝗣\n` +
        `💵 Argent : ${userMoney.toLocaleString()}\n` +
        `✨ XP : ${currentXP}/1000\n` +
        `🎯 XP restant : ${xpTo1000}\n` +
        `${xpProgressBar} ${xpProgress.toFixed(1)}%\n\n` +
        `🔥 𝗦é𝗿𝗶𝗲𝘀\n` +
        `${streakInfo}\n` +
        `${bestStreakInfo}\n\n` +
        `🎯 Prochain palier : ${user.nextMilestone || "Continue à jouer !"}`,
        threadID,
        messageID
      );
    } catch {
      return api.sendMessage("⚠️ Impossible de récupérer ton profil. Réessaie plus tard.", threadID, messageID);
    }
  },

  async handleLeaderboard(api, threadID, messageID, args) {
    try {
      const page = parseInt(args?.[0]) || 1;
      const res = await axios.get(`${BASE_URL}/leaderboards?page=${page}&limit=8`);
      const { rankings, stats, pagination } = res.data;

      if (!rankings || rankings.length === 0) {
        return api.sendMessage("🏆 Aucun joueur dans le classement. Sois le premier !", threadID, messageID);
      }

      const now = new Date();
      const currentDate = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
      const currentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });

      const players = await Promise.all(rankings.map(async (u, i) => {
        let userName = u.name || 'Joueur Anonyme';
        if (u.userId && userName === 'Joueur Anonyme') {
          userName = await this.getUserName(api, u.userId) || 'Joueur Anonyme';
        }
        const position = (pagination.currentPage - 1) * 8 + i + 1;
        const crown = position === 1 ? "👑" : position === 2 ? "🥈" : position === 3 ? "🥉" : position <= 10 ? "🏅" : "🎯";
        const title = this.getUserTitle(u.correct || 0);
        const level = u.level ?? Math.floor((u.correct || 0) / 50) + 1;
        const xp = u.xp ?? (u.correct || 0) * 10;
        const accuracy = u.accuracy ?? (u.total > 0 ? Math.round((u.correct / u.total) * 100) : 0);
        const avgResponseTime = typeof u.avgResponseTime === 'number' ? `${u.avgResponseTime.toFixed(2)}s` : 'N/A';
        const fastest = u.fastestResponse?.toFixed(2) || 'N/A';
        const slowest = u.slowestResponse?.toFixed(2) || 'N/A';
        const playTime = u.totalPlayTime ? `${(u.totalPlayTime / 60).toFixed(1)} min` : '0 min';
        const games = u.gamesPlayed || u.total || 0;
        const perfectGames = u.perfectGames || 0;
        const joinDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : 'Inconnue';

        return `${crown} #${position} ${userName}\n` +
               `🎖️ ${title} | 🌟 Niv.${level} | ✨ XP: ${xp.toLocaleString()}\n` +
               `📊 ${u.correct} ✅ / ${u.wrong} ❌ (Précision: ${accuracy}%)\n` +
               `🔥 Série actuelle: ${u.currentStreak || 0} | 🏅 Meilleure: ${u.bestStreak || 0}\n` +
               `⚡ Temps moyen: ${avgResponseTime} | 🚀 Plus rapide: ${fastest}s | 🐌 Plus lent: ${slowest}s\n` +
               `🎯 Questions: ${u.questionsAnswered} | Parties: ${games}\n` +
               `🎮 Temps de jeu: ${playTime} | 📈 Sans faute: ${perfectGames}\n` +
               `📅 Inscrit: ${joinDate}`;
      }));

      return api.sendMessage(
        `🏆 𝗖𝗹𝗮𝘀𝘀𝗲𝗺𝗲𝗻𝘁 𝗚𝗹𝗼𝗯𝗮𝗹\n━━━━━━━━━\n\n` +
        `📅 ${currentDate}\n⏰ ${currentTime} UTC\n\n` +
        `━━━━━━━━━\n\n${players.join('\n\n')}\n\n` +
        `📖 Page ${pagination?.currentPage || 1}/${pagination?.totalPages || 1} | 👥 Total: ${stats?.totalUsers || 0}\n` +
        `🔄 Utilise: quiz leaderboard <page>`,
        threadID,
        messageID
      );
    } catch {
      return api.sendMessage("⚠️ Impossible de récupérer le classement.", threadID, messageID);
    }
  },

  async handleCategories(api, threadID, messageID) {
    try {
      const res = await axios.get(`${BASE_URL}/categories`);
      const categories = res.data;
      const catText = categories.map(c => `📍 ${c.charAt(0).toUpperCase() + c.slice(1)}`).join("\n");

      return api.sendMessage(
        `📚 𝗖𝗮𝘁é𝗴𝗼𝗿𝗶𝗲𝘀 𝗱𝗲 𝗤𝘂𝗶𝘇\n━━━━━━━━\n\n${catText}\n\n` +
        `🎯 Utilise: quiz <catégorie>\n` +
        `🎲 Aléatoire: quiz random\n` +
        `🏆 Défi quotidien: quiz daily\n` +
        `🌟 Spéciaux: quiz torf, quiz flag, quiz anime`,
        threadID,
        messageID
      );
    } catch {
      return api.sendMessage("⚠️ Impossible de récupérer les catégories.", threadID, messageID);
    }
  },

  async handleCategoryLeaderboard(api, threadID, messageID, args) {
    try {
      const category = args[0]?.toLowerCase();
      if (!category) {
        return api.sendMessage("📚 Précise une catégorie pour voir son classement.", threadID, messageID);
      }
      const page = parseInt(args[1]) || 1;
      const res = await axios.get(`${BASE_URL}/leaderboard/category/${category}?page=${page}&limit=10`);
      const { users, pagination } = res.data;

      if (!users || users.length === 0) {
        return api.sendMessage(`🏆 Aucun joueur trouvé pour la catégorie : ${category}.`, threadID, messageID);
      }

      const topPlayersWithNames = await Promise.all(users.map(async (u, i) => {
        let userName = 'Joueur Anonyme';
        if (u.userId) {
          userName = await this.getUserName(api, u.userId) || 'Joueur Anonyme';
        }
        const position = (pagination.currentPage - 1) * 10 + i + 1;
        const crown = position === 1 ? "👑" : position === 2 ? "🥈" : position === 3 ? "🥉" : "🏅";
        const title = this.getUserTitle(u.correct || 0);
        return `${crown} #${position} ${userName}\n🎖️ ${title}\n📊 ${u.correct || 0}/${u.total || 0} (${u.accuracy || 0}%)`;
      }));

      return api.sendMessage(
        `🏆 𝗖𝗹𝗮𝘀𝘀𝗲𝗺𝗲𝗻𝘁 : ${category.charAt(0).toUpperCase() + category.slice(1)}\n━━━━━━━━━\n\n${topPlayersWithNames.join('\n\n')}\n\n` +
        `📖 Page ${pagination.currentPage}/${pagination.totalPages}\n` +
        `👥 Total Joueurs : ${pagination.totalUsers}`,
        threadID,
        messageID
      );
    } catch {
      return api.sendMessage("⚠️ Impossible de récupérer le classement de cette catégorie.", threadID, messageID);
    }
  },

  async handleDailyChallenge(api, threadID, messageID, senderID, commandName) {
    try {
      const res = await axios.get(`${BASE_URL}/challenge/daily?userId=${senderID}`);
      const { question, challengeDate, reward, streak } = res.data;

      // Traduire la question
      const translatedQuestion = await translateToFrench(question.question);

      const optText = question.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n");

      const info = await api.sendMessage(
        `🌟 𝗗é𝗳𝗶 𝗤𝘂𝗼𝘁𝗶𝗱𝗶𝗲𝗻\n━━━━━━━━━\n\n` +
        `📅 ${challengeDate}\n` +
        `🎯 Bonus : +${reward} XP\n` +
        `🔥 Série quotidienne : ${streak}\n\n\n` +
        `❓ ${translatedQuestion}\n\n${optText}\n\n⏰ 30 secondes pour répondre !`,
        threadID,
        messageID
      );

      global.noobCore.ncReply.set(info.messageID, {
        commandName,
        author: senderID,
        messageID: info.messageID,
        answer: question.answer,
        questionId: question._id,
        startTime: Date.now(),
        isDailyChallenge: true,
        bonusReward: reward
      });

      setTimeout(() => {
        const r = global.noobCore.ncReply.get(info.messageID);
        if (r) {
          api.sendMessage(`⏰ Temps écoulé ! La bonne réponse était : ${question.answer}`, threadID);
          api.unsendMessage(info.messageID);
          global.noobCore.ncReply.delete(info.messageID);
        }
      }, 30000);
    } catch {
      return api.sendMessage("⚠️ Impossible de créer le défi quotidien.", threadID, messageID);
    }
  },

  async handleTrueOrFalse(api, threadID, messageID, senderID, commandName) {
    try {
      const res = await axios.get(`${BASE_URL}/question?category=torf&userId=${senderID}`);
      const { _id, question, answer } = res.data;

      // Traduire la question
      const translatedQuestion = await translateToFrench(question);

      const info = await api.sendMessage(
        `⚙ 𝗤𝘂𝗶𝘇 ( Vrai/Faux )\n━━━━━━━━━━\n\n💭 Question : ${translatedQuestion}\n\n😆 : Vrai\n😮 : Faux\n\nRéagis avec l'emoji correspondant.\n⏰ 30 secondes pour répondre.`,
        threadID,
        messageID
      );

      const correctAnswer = answer.toUpperCase();

      global.noobCore.ncReaction.set(info.messageID, {
        commandName,
        author: senderID,
        messageID: info.messageID,
        answer: correctAnswer,
        reacted: false,
        reward: 10000,
        questionId: _id,
        startTime: Date.now()
      });

      setTimeout(() => {
        const reaction = global.noobCore.ncReaction.get(info.messageID);
        if (reaction && !reaction.reacted) {
          const correctText = correctAnswer === "A" ? "Vrai" : "Faux";
          api.sendMessage(`⏰ Temps écoulé ! Bonne réponse : ${correctText}`, threadID);
          api.unsendMessage(info.messageID);
          global.noobCore.ncReaction.delete(info.messageID);
        }
      }, 30000);
    } catch {
      return api.sendMessage("⚠️ Impossible de créer une question Vrai/Faux.", threadID, messageID);
    }
  },

  async handleFlagQuiz(api, threadID, messageID, senderID, commandName) {
    try {
      const res = await axios.get(`${BASE_URL}/question?category=flag&userId=${senderID}`);
      const { _id, question, options, answer } = res.data;

      // Pour flag, 'question' est l'URL de l'image, pas besoin de traduction
      const flagEmbed = {
        body: `🏁 𝗤𝘂𝗶𝘇 𝗗𝗿𝗮𝗽𝗲𝗮𝘂\n━━━━━━━━\n\n🌍 Devine le pays de ce drapeau :\n\n` +
              options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n") +
              `\n\n⏰ Temps : 30 secondes pour répondre.`,
        attachment: question ? await global.utils.getStreamFromURL(question) : null
      };

      const info = await api.sendMessage(flagEmbed, threadID, messageID);

      global.noobCore.ncReply.set(info.messageID, {
        commandName,
        author: senderID,
        messageID: info.messageID,
        answer,
        options,
        questionId: _id,
        startTime: Date.now(),
        isFlag: true,
        reward: 12000
      });

      setTimeout(() => {
        const r = global.noobCore.ncReply.get(info.messageID);
        if (r) {
          api.sendMessage(`⏰ Temps écoulé ! La bonne réponse était : ${answer}`, threadID);
          api.unsendMessage(info.messageID);
          global.noobCore.ncReply.delete(info.messageID);
        }
      }, 30000);
    } catch {
      return api.sendMessage("⚠️ Impossible de créer un quiz drapeau.", threadID, messageID);
    }
  },

  async handleAnimeQuiz(api, threadID, messageID, senderID, commandName) {
    try {
      const res = await axios.get(`${BASE_URL}/question?category=anime&userId=${senderID}`);
      const { _id, question, options, answer, imageUrl } = res.data;

      // Traduire l'indice (question)
      const translatedHint = await translateToFrench(question);

      const animeEmbed = {
        body: `🎌 𝗤𝘂𝗶𝘇 𝗔𝗻𝗶𝗺𝗲\n━━━━━━━━\n\n❔ Indice : ${translatedHint}\n\n` +
              options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n") +
              `\n\n⏰ Temps : 30 secondes\n🎯 Reconnais le personnage !`,
        attachment: imageUrl ? await global.utils.getStreamFromURL(imageUrl) : null
      };

      const info = await api.sendMessage(animeEmbed, threadID, messageID);

      global.noobCore.ncReply.set(info.messageID, {
        commandName,
        author: senderID,
        messageID: info.messageID,
        answer,
        options,
        questionId: _id,
        startTime: Date.now(),
        isAnime: true,
        reward: 15000
      });

      setTimeout(() => {
        const r = global.noobCore.ncReply.get(info.messageID);
        if (r) {
          api.sendMessage(`⏰ Temps écoulé ! La bonne réponse était : ${answer}\n🎌 Continue à regarder des animes pour t'améliorer !`, threadID);
          api.unsendMessage(info.messageID);
          global.noobCore.ncReply.delete(info.messageID);
        }
      }, 30000);
    } catch {
      return api.sendMessage("⚠️ Impossible de créer un quiz anime.", threadID, messageID);
    }
  },

  async handleQuiz(api, threadID, messageID, senderID, args, commandName, forcedDifficulty = null, usersData) {
    try {
      const userName = await this.getUserName(api, senderID);
      await axios.post(`${BASE_URL}/user/update`, { userId: senderID, name: userName });

      const category = args[0]?.toLowerCase() || "";
      let queryParams = { userId: senderID };
      if (category && category !== "random") queryParams.category = category;
      if (forcedDifficulty) queryParams.difficulty = forcedDifficulty;

      const res = await axios.get(`${BASE_URL}/question`, { params: queryParams });
      const { _id, question, options, answer, category: qCategory, difficulty } = res.data;

      // Traduire la question
      const translatedQuestion = await translateToFrench(question);

      const optText = options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n");

      const info = await api.sendMessage(
        `🎯 𝗤𝘂𝗶𝘇 𝗖𝗵𝗮𝗹𝗹𝗲𝗻𝗴𝗲\n━━━━━━━━━━\n\n` +
        `📚 Catégorie : ${qCategory?.charAt(0).toUpperCase() + qCategory?.slice(1) || "Aléatoire"}\n` +
        `🎚️ Difficulté : ${difficulty?.charAt(0).toUpperCase() + difficulty?.slice(1) || "Moyenne"}\n` +
        `❓ Question : ${translatedQuestion}\n\n${optText}\n\n⏰ 30 secondes pour répondre (A/B/C/D) :`,
        threadID,
        messageID
      );

      global.noobCore.ncReply.set(info.messageID, {
        commandName,
        author: senderID,
        messageID: info.messageID,
        answer,
        questionId: _id,
        startTime: Date.now(),
        difficulty,
        category: qCategory
      });

      setTimeout(() => {
        const r = global.noobCore.ncReply.get(info.messageID);
        if (r) {
          api.sendMessage(`⏰ Temps écoulé ! La bonne réponse était : ${answer}`, threadID);
          api.unsendMessage(info.messageID);
          global.noobCore.ncReply.delete(info.messageID);
        }
      }, 30000);
    } catch (err) {
      console.error("Erreur quiz:", err);
      api.sendMessage("⚠️ Impossible de récupérer une question. Essaie 'quiz categories' pour voir les options disponibles.", threadID, messageID);
    }
  }
};