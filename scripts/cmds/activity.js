const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// --- Helpers ---
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// --- Variable globale pour le wallpaper ---
let wallpaper = null;

module.exports = {
  config: {
    name: "activity",
    version: "5.1",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: "Generate flashy activity dashboard with custom background and themes",
    category: "info",
    guide: "{pn} [@tag or userID] / setwall / themes / createtheme"
  },

  onStart: async function ({ event, message, usersData, threadsData, args, globalData }) {
    try {
      const senderID = event.senderID;
      const messageReply = event.messageReply;

      // --------------------------
      // Handle setwall command
      // --------------------------
      if (args[0] && args[0].toLowerCase() === 'setwall') {
        if (!messageReply || !messageReply.attachments || messageReply.attachments.length === 0) {
          return message.reply("❌ Vous devez répondre à une image pour définir le wallpaper.");
        }

        const imageUrl = messageReply.attachments[0].url;
        try {
          const cacheDir = path.join(__dirname, "cache");
          if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

          const wallPath = path.join(cacheDir, `wallpaper_${senderID}.jpg`);
          const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          fs.writeFileSync(wallPath, response.data);

          wallpaper = wallPath;
          return message.reply("✅ Arrière-plan personnalisé défini avec succès !");
        } catch (error) {
          console.error("Erreur lors du téléchargement du wallpaper :", error);
          return message.reply("❌ Impossible de définir l'arrière-plan.");
        }
      }

      // --------------------------
      // Handle themes command
      // --------------------------
      if (args[0] && args[0].toLowerCase() === 'themes') {
        const customThemes = await getCustomThemes(globalData);
        const allThemes = { ...themes, ...customThemes };

        let themeList = "";
        let count = 0;

        const popularThemes = ['classic', 'love', 'tie_dye', 'space', 'forest', 'sunset'];
        const gradientThemes = ['ocean', 'berry', 'sunflower', 'lavender', 'rose', 'peach'];
        const colorThemes = ['mint', 'grape', 'lemon', 'sky', 'cotton_candy', 'neon'];
        const specialThemes = ['rainbow', 'gold', 'silver', 'coffee', 'midnight', 'aurora'];
        const gemThemes = ['emerald', 'sapphire', 'amethyst', 'ruby', 'tropical', 'galaxy'];

        themeList += "🌟 POPULAR THEMES:\n";
        popularThemes.forEach(t => { if (allThemes[t]) { themeList += `• ${t}\n`; count++; } });
        themeList += "\n🎨 GRADIENT THEMES:\n";
        gradientThemes.forEach(t => { if (allThemes[t]) { themeList += `• ${t}\n`; count++; } });
        themeList += "\n🌈 COLOR THEMES:\n";
        colorThemes.forEach(t => { if (allThemes[t]) { themeList += `• ${t}\n`; count++; } });
        themeList += "\n💎 SPECIAL THEMES:\n";
        specialThemes.forEach(t => { if (allThemes[t]) { themeList += `• ${t}\n`; count++; } });
        themeList += "\n✨ GEM THEMES:\n";
        gemThemes.forEach(t => { if (allThemes[t]) { themeList += `• ${t}\n`; count++; } });

        const customThemeNames = Object.keys(customThemes);
        if (customThemeNames.length > 0) {
          themeList += "\n🎯 CUSTOM THEMES:\n";
          customThemeNames.forEach(t => { themeList += `• ${t}\n`; count++; });
        }

        return message.reply(getLang("themeList", count, themeList) + "\n" + getLang("customThemeHelp"));
      }

      // --------------------------
      // Handle createtheme command
      // --------------------------
      if (args[0] && args[0].toLowerCase() === 'createtheme') {
        if (args.length < 6) return message.reply(getLang("themeCreateError"));

        const [, themeName, bgColor, primaryColor, secondaryColor, gradient] = args;
        const newTheme = { bgColor, primaryColor, secondaryColor, gradient: gradient || null };

        const success = await saveCustomTheme(globalData, senderID, themeName, newTheme);
        if (success) return message.reply(`✅ Thème personnalisé "${themeName}" créé avec succès !`);
        else return message.reply("❌ Erreur lors de la création du thème.");
      }

      // --------------------------
      // Génération du dashboard
      // --------------------------
      const uid = event.type === "message_reply" ? messageReply.senderID : Object.keys(event.mentions)[0] || senderID;
      const userData = await usersData.get(uid);
      const threadData = await threadsData.get(event.threadID);
      const member = threadData.members.find(e => e.userID === uid);
      const totalMessages = member?.count || 0;

      const trend30 = [], hours24 = [];
      let peak = 0;
      for (let i = 0; i < 30; i++) {
        let base = Math.floor(totalMessages * 0.03);
        let v = Math.floor(base * (0.6 + Math.random() * 0.9));
        trend30.push(v);
        if (v > peak) peak = v;
      }
      for (let i = 0; i < 24; i++) hours24.push(Math.floor(Math.floor(totalMessages/30)*0.5*(0.5 + Math.random()*1.2)));

      const percentText = 0.55 + Math.random()*0.15;
      const percentReact = 0.20 + Math.random()*0.1;
      const percentMedia = 0.10 + Math.random()*0.1;
      const percentGif = 1 - (percentText+percentReact+percentMedia);
      const breakdown = {
        text: Math.floor(totalMessages*percentText),
        reactions: Math.floor(totalMessages*percentReact),
        media: Math.floor(totalMessages*percentMedia),
        gif: Math.floor(totalMessages*percentGif)
      };

      await generateDashboard({ uid, totalMessages, trend30, hours24, peak, breakdown, name: userData.name }, message, usersData);

    } catch (err) {
      console.error(err);
      message.reply("❌ Erreur lors de l'exécution de la commande.");
    }
  }
};

// --------------------------
// Dashboard generator
// --------------------------
async function generateDashboard(data, message, usersData) {
  const WIDTH = 1080, HEIGHT = 1500;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // Background
  if (wallpaper && fs.existsSync(wallpaper)) {
    const bgImg = await loadImage(wallpaper);
    ctx.drawImage(bgImg, 0, 0, WIDTH, HEIGHT);
  } else {
    const bg = ctx.createLinearGradient(0,0,0,HEIGHT);
    bg.addColorStop(0,"#0A0F29"); bg.addColorStop(1,"#0E1335");
    ctx.fillStyle = bg; ctx.fillRect(0,0,WIDTH,HEIGHT);
  }

  // Title & Name
  ctx.fillStyle="white"; ctx.font="bold 60px Arial"; ctx.textAlign="center";
  ctx.fillText("DASHBOARD", WIDTH/2,90);
  ctx.font="bold 40px Arial"; ctx.fillText(data.name, WIDTH/2,150);

  // Avatar
  let img;
  try {
    const avatarUrl = await usersData.getAvatarUrl(data.uid);
    const buffer = await axios.get(avatarUrl,{responseType:'arraybuffer'});
    img = await loadImage(Buffer.from(buffer.data));
  } catch {
    img = await loadImage(path.join(__dirname,"default_avatar.png"));
  }
  ctx.save();
  ctx.beginPath(); ctx.arc(WIDTH/2,260,90,0,Math.PI*2); ctx.closePath(); ctx.clip();
  ctx.drawImage(img,WIDTH/2-90,170,180,180); ctx.restore();

  // Info Cards
  const cards = [
    { label:"Total Messages", value: formatNumber(data.totalMessages), color:"#3B82F6" },
    { label:"Average Daily", value: Math.floor(data.totalMessages/30), color:"#F59E0B" },
    { label:"Peak Activity", value: data.peak, color:"#EF4444" },
    { label:"Role", value:"Member", color:"#A855F7" }
  ];
  let x=80;
  for(let c of cards){
    ctx.fillStyle=c.color; ctx.globalAlpha=0.2; ctx.fillRect(x,360,220,120);
    ctx.globalAlpha=1; ctx.strokeStyle=c.color; ctx.lineWidth=4; ctx.strokeRect(x,360,220,120);
    ctx.fillStyle="white"; ctx.font="24px Arial"; ctx.fillText(c.label,x+110,405);
    ctx.font="bold 32px Arial"; ctx.fillText(String(c.value),x+110,455);
    x+=260;
  }

  // 30-Day Trend Chart
  ctx.font="bold 32px Arial"; ctx.fillStyle="#fff"; ctx.fillText("30-DAY ACTIVITY TREND",WIDTH/2,540);
  const gX=120,gY=580,gW=WIDTH-240,gH=250,maxVal=Math.max(...data.trend30),barW=gW/30-4;
  for(let i=0;i<30;i++){
    let h=(data.trend30[i]/maxVal)*gH,y=gY+(gH-h);
    ctx.fillStyle="#3B82F6"; ctx.shadowColor="#fff"; ctx.shadowBlur=10; ctx.globalAlpha=0.7;
    ctx.fillRect(gX+i*(barW+4),y,barW,h);
  }
  ctx.globalAlpha=1; ctx.shadowBlur=0;

  // 24-Hour Heatmap
  ctx.font="bold 32px Arial"; ctx.fillStyle="#fff"; ctx.fillText("24-HOUR ACTIVITY PATTERN",WIDTH/2,900);
  const hX=100,hY=940,maxH=Math.max(...data.hours24);
  for(let i=0;i<24;i++){
    const intensity=data.hours24[i]/maxH;
    ctx.fillStyle=`rgba(59,130,246,${0.3+intensity*0.7})`;
    ctx.fillRect(hX+i*36,hY,32,32);
  }

  // Breakdown Pie Chart
  ctx.font="bold 32px Arial"; ctx.fillStyle="#fff"; ctx.textAlign="center";
  ctx.fillText("MESSAGE BREAKDOWN",WIDTH/2,1100);
  const total=Object.values(data.breakdown).reduce((a,b)=>a+b,0);
  const colors=["#3B82F6","#F59E0B","#10B981","#A855F7"];
  const labels=["Text Messages","Reactions","Media Shared","Stickers/GIFs"];
  const values=[data.breakdown.text,data.breakdown.reactions,data.breakdown.media,data.breakdown.gif];
  let angle=-Math.PI/2,cx=300,cy=1250,r=120;
  for(let i=0;i<values.length;i++){
    const slice=(values[i]/total)*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,angle,angle+slice); ctx.closePath();
    ctx.fillStyle=colors[i]; ctx.shadowColor="#fff"; ctx.shadowBlur=10; ctx.fill(); angle+=slice;
  }
  ctx.shadowBlur=0;

  // Legend
  let lx=500,ly=1180; ctx.font="22px Arial"; ctx.textAlign="left";
  for(let i=0;i<labels.length;i++){
    ctx.fillStyle=colors[i]; ctx.fillRect(lx,ly+i*40,28,28);
    ctx.fillStyle="white"; ctx.fillText(`${labels[i]}: ${values[i]}`,lx+40,ly+22+i*40);
  }

  // Save
  const tmp = path.join(__dirname,"tmp"); if(!fs.existsSync(tmp)) fs.mkdirSync(tmp);
  const file = path.join(tmp,`dashboard_${data.uid}.png`);
  const out = fs.createWriteStream(file);
  canvas.createPNGStream().pipe(out);
  out.on("finish",()=>{ message.reply({attachment: fs.createReadStream(file)},()=>fs.unlinkSync(file)); });
                               }
