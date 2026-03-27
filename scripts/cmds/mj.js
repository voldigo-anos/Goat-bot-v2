const axios = require("axios");
const fs = require("fs");
const path = require("path");

const TASK_JSON = path.join(__dirname, "midj_tasks.json");
if (!fs.existsSync(TASK_JSON)) fs.writeFileSync(TASK_JSON, "{}");

// === CONFIGURATION ===
const BASE_URL = "https://midjanuarybyxnil.onrender.com";

module.exports = {
  config: {
    name: "midjourney",
    aliases: ["midj", "mj"],
    author: "Christus",
    version: "2.4",
    role: 0,
    shortDescription: "Génération d'image IA (API MJ rapide)",
    longDescription: "Génère et améliore des images style Midjourney via une API rapide",
    category: "image",
    guide: "{pn} <prompt>"
  },

  onStart: async function ({ args, message, event }) {
    try {
      const prompt = args.join(" ").trim();
      if (!prompt) return message.reply("⚠️ Veuillez fournir un prompt.");

      const processingMsg = await message.reply("🎨 Génération de votre image...");

      // === Demande de génération d'image ===
      const genRes = await axios.get(`${BASE_URL}/imagine?prompt=${encodeURIComponent(prompt)}`);
      const data = genRes.data;

      console.log("🔍 Réponse API :", data);

      if (!data || !data.murl) {
        await message.unsend(processingMsg.messageID);
        return message.reply("❌ Échec du lancement de la génération ou réponse invalide du serveur.");
      }

      const taskId = data.taskId || "inconnu";
      const murl = data.murl;

      // === Sauvegarde de la tâche ===
      const tasks = JSON.parse(fs.readFileSync(TASK_JSON, "utf8"));
      tasks[event.threadID] = taskId;
      fs.writeFileSync(TASK_JSON, JSON.stringify(tasks, null, 2));

      // === Envoi de l'image générée ===
      await message.unsend(processingMsg.messageID);

      const imgStream = await global.utils.getStreamFromURL(murl);
      const bodyText = "🖼️ Image générée\n💬 Répondez avec U1–U4 pour améliorer.";

      const sentMsg = await message.reply({
        body: bodyText,
        attachment: imgStream
      });

      // === Sauvegarde du contexte pour la réponse ===
      global.GoatBot.onReply.set(sentMsg.messageID, {
        commandName: this.config.name,
        taskId,
        threadID: event.threadID,
        messageID: sentMsg.messageID
      });

    } catch (err) {
      console.error("Erreur de génération :", err);
      return message.reply("❌ Échec de la génération de l'image. Veuillez réessayer plus tard.");
    }
  },

  onReply: async function ({ event, Reply, message }) {
    try {
      const action = event.body.toLowerCase();
      if (!["u1", "u2", "u3", "u4"].includes(action)) return;

      const cid = action.replace("u", "");
      const processingMsg = await message.reply(`🔄 Amélioration ${action.toUpperCase()} en cours...`);

      const res = await axios.get(`${BASE_URL}/up?tid=${Reply.taskId}&cid=${cid}`);
      const data = res.data;

      console.log("🔍 Réponse amélioration :", data);

      if (!data || !data.url) {
        await message.unsend(processingMsg.messageID);
        return message.reply(`❌ Échec de l'amélioration ${action.toUpperCase()}. Veuillez réessayer.`);
      }

      await message.unsend(processingMsg.messageID);

      const imgStream = await global.utils.getStreamFromURL(data.url);
      const resultMsg = `✅ Amélioration ${action.toUpperCase()} terminée\n💬 Vous pouvez répondre à nouveau avec U1–U4.`;

      const sentMsg = await message.reply({
        body: resultMsg,
        attachment: imgStream
      });

      global.GoatBot.onReply.set(sentMsg.messageID, {
        commandName: Reply.commandName,
        taskId: data.tid || Reply.taskId,
        threadID: event.threadID,
        messageID: sentMsg.messageID
      });

    } catch (err) {
      console.error("Erreur lors de l'amélioration :", err);
      return message.reply("❌ Erreur lors du traitement de la demande d'amélioration.");
    }
  }
};
