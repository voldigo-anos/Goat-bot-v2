module.exports = {
  config: {
    name: "set",
    version: "2.0",
    author: "Christus",
    shortDescription: "Gestion des données admin",
    longDescription: "Définir l'argent, l'expérience ou des variables personnalisées d'un utilisateur (admin uniquement)",
    category: "Admin",
    guide: {
      fr: "{p}set money [montant] [@utilisateur]\n{p}set exp [montant] [@utilisateur]\n{p}set custom [variable] [valeur] [@utilisateur]"
    },
    role: 2
  },

  onStart: async function ({ api, event, args, usersData }) {
    try {
      const ADMIN_UIDS = ["61580333625022", "61568791604271"];
      
      if (!ADMIN_UIDS.includes(event.senderID.toString())) {
        return api.sendMessage("⛔ Accès refusé : privilèges admin requis", event.threadID);
      }

      const action = args[0]?.toLowerCase();
      const amount = parseFloat(args[1]);
      const targetID = Object.keys(event.mentions)[0] || event.senderID;
      const userData = await usersData.get(targetID);

      if (!userData) {
        return api.sendMessage("❌ Utilisateur introuvable dans la base de données", event.threadID);
      }

      switch (action) {
        case 'money':
          if (isNaN(amount)) return api.sendMessage("❌ Montant invalide", event.threadID);
          await usersData.set(targetID, { money: amount });
          return api.sendMessage(`💰 Argent défini à ${amount} pour ${userData.name}`, event.threadID);

        case 'exp':
          if (isNaN(amount)) return api.sendMessage("❌ Montant invalide", event.threadID);
          await usersData.set(targetID, { exp: amount });
          return api.sendMessage(`🌟 Expérience définie à ${amount} pour ${userData.name}`, event.threadID);

        case 'custom':
          const variable = args[1];
          const value = args[2];
          if (!variable || value === undefined) {
            return api.sendMessage("❌ Utilisation : {p}set custom [variable] [valeur] [@utilisateur]", event.threadID);
          }
          await usersData.set(targetID, { [variable]: value });
          return api.sendMessage(`🔧 Variable ${variable} définie à ${value} pour ${userData.name}`, event.threadID);

        default:
          return api.sendMessage("❌ Action invalide. Options disponibles : money, exp, custom", event.threadID);
      }

    } catch (error) {
      console.error("Erreur Admin Set :", error);
      return api.sendMessage("⚠️ Commande échouée : " + error.message, event.threadID);
    }
  }
};
