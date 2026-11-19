# Court Vision Playbook Studio

Quero um aplicativo para editar vídeos de basquete de forma profissional e simples, que eu possa fazer desenhos e marcações para demonstrar jogadas.

Quero exportar vídeos com os desenhos para publicar em redes sociais.

Se já existir um aplicativo que faça isso, use como referência. Referências encontradas: Axis (axisclip.com), GameTrace (gametrace.app) e Play Maker Studio (triplethreatbasketballtraining.com/playmaker).

This project was built with [Lovable](https://lovable.dev).

## Dois modos

**Editor de vídeo** (`/`): desenha setas, círculos, zonas e textos sobre o vídeo real do jogo, com timeline, tags de basquete, biblioteca local e exportação MP4 em 9:16, 1:1, 16:9 ou original.

**Prancheta 3D** (`/prancheta`): anima jogadas em quadra 3D com bonecos, setas animadas e laranja neon, no formato de Reels do método "gancho que contraria + prancheta animada + chamada para comentar". Traz quatro jogadas prontas (Triângulo ofensivo, Pick and roll, Horns e Zona 2-3), textos editáveis e gravação em 1080×1920. Use `?w=720&h=1280` na URL para renderizar mais leve em aparelhos sem GPU.

O editor exporta com MediaRecorder e recodifica o áudio para AAC quando o navegador grava Opus, garantindo compatibilidade com Instagram, TikTok e WhatsApp.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cd7d985b-0070-4e27-930a-58f730e1f4b8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
