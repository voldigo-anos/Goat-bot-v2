module.exports = {
  config: {
    name: "levelup",
    version: "1.3",
    author: "Christus",
    countDown: 5,
    role: 1,
    shortDescription: {
      fr: "Définir le niveau d'un utilisateur (avec synchronisation de l'XP)"
    },
    description: {
      fr: "Augmente ou réduit le niveau d'un utilisateur et synchronise l'XP avec le système de classement"
    },
    category: "ranking",
    guide: {
      fr: "{pn} @tag 10/20\n{pn} 25\n{pn} 100081330372098 -5 (par UID)"
    }
  },

  onStart: async function ({ message, event, args, usersData, envCommands }) {
    const deltaNext = envCommands["rank"]?.deltaNext || 5;

    // 🧠 Déterminer l'ID cible (tag/réponse/UID)
    let targetID;
    if (event.type === "message_reply") {
      targetID = event.messageReply.senderID;
      args.shift();
    } else if (Object.keys(event.mentions || {}).length > 0) {
      targetID = Object.keys(event.mentions)[0];
      args.shift();
    } else if (/^\d{6,}$/.test(args[0])) {
      targetID = args.shift();
    }

    if (!targetID)
      return message.reply("❌ | Veuillez taguer, répondre ou fournir un UID de l'utilisateur.");

    const input = args.find(arg => !isNaN(arg) || arg.includes("/"));
    if (!input)
      return message.reply("⚠️ | Fournissez un nombre de niveau ou une plage (ex: 10/20 ou -5)");

    // 🎯 Analyser le changement de niveau
    let levelChange;
    if (input.includes("/")) {
      const [min, max] = input.split("/").map(Number);
      if (isNaN(min) || isNaN(max) || min > max)
        return message.reply("❌ Plage invalide.");
      levelChange = Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
      levelChange = parseInt(input);
    }

    // 🧮 Récupérer l'utilisateur et calculer niveau/XP
    const userData = await usersData.get(targetID);
    if (!userData)
      return message.reply("❌ | Utilisateur non trouvé dans la base de données.");

    const oldExp = userData.exp || 0;
    const oldLevel = Math.floor((1 + Math.sqrt(1 + 8 * oldExp / deltaNext)) / 2);
    const newLevel = oldLevel + levelChange;
    const newExp = Math.floor(((newLevel ** 2 - newLevel) * deltaNext) / 2);

    await usersData.set(targetID, { exp: newExp });

    return message.reply(
      `📈 MISE À JOUR DU NIVEAU\n━━━━━━━━━━━━━━\n👤 Utilisateur : ${userData.name} (${targetID})\n🎚️ Niveau : ${oldLevel} → ${newLevel}\n✨ XP : ${oldExp} → ${newExp}`
    );
  }
};
