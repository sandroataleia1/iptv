# Painel e API IPTV Lab

O backend utiliza PHP 7.4 ou superior, MySQL 5.7 ou superior, PDO MySQL e OpenSSL. Configure o subdomínio `iptv.esis.com.br` para HTTPS e aponte seu document root para `backend/public`. Mantenha `config.php` e `storage/` fora do document root.

## Instalação

1. Crie um banco MySQL e um usuário com acesso somente a esse banco. Importe `schema.sql`.
2. Copie `config.example.php` para `config.php`, no diretório `backend`, e preencha host, banco, usuário e senha do MySQL, URL do provedor IPTV e a URL HTTPS pública `https://iptv.esis.com.br/`.
3. Gere a chave de criptografia e o hash da senha administrativa no servidor:

   ```sh
   php -r "echo base64_encode(random_bytes(32)), PHP_EOL;"
   php -r "echo password_hash('SUA-SENHA-ADMINISTRATIVA', PASSWORD_DEFAULT), PHP_EOL;"
   ```

   Coloque os resultados nos campos `encryption_key` e `admin_password_hash` de `config.php`. Guarde uma cópia segura da chave: senhas IPTV já gravadas dependem dela para serem descriptografadas.
4. Configure `pix_key` e `whatsapp` (código do país + DDD + número, somente dígitos). Também podem ser alterados pela página Configurações do painel.
5. Restrinja as permissões de `config.php` (por exemplo, `0600`) e da pasta `backend/storage` (por exemplo, `0700`). A pasta de armazenamento deve permanecer fora do document root.
6. Publique o conteúdo de `backend/public` no document root do subdomínio. O painel ficará em `https://iptv.esis.com.br/admin.php`.
7. No servidor, permita uploads de APK de até 300 MB configurando `upload_max_filesize`, `post_max_size` e `max_execution_time` do PHP.
8. Distribua e instale o APK atual. Abra-o uma vez para gerar seu identificador; copie o ID exibido e cadastre-o em Gerenciar apps no painel. Cada aparelho cadastrado recebe nome, usuário/senha IPTV e vencimento.

O endpoint do app está configurado em `app-config.js` como `https://iptv.esis.com.br/api.php`. Se o endereço mudar, atualize esse arquivo e gere um novo APK.

## Operação

- O painel exige uma senha administrativa e protege alterações com sessão, token CSRF e consultas parametrizadas.
- Senhas IPTV são armazenadas no MySQL criptografadas com AES-256-GCM. O app as recebe somente pelo endpoint HTTPS para consultar a conta e reproduzir seus canais.
- A cada abertura, o app consulta o painel e atualiza a lista diretamente no provedor. Aparelhos vencidos continuam abrindo, mas a reprodução fica bloqueada e são exibidos Pix e WhatsApp, quando configurados.
- A partir de cinco dias antes do vencimento, a informação de assinatura fica laranja. A prorrogação da data no painel registra um histórico de renovação.
- Para publicar uma atualização, incremente `versionCode` e `versionName` em `android/app/build.gradle` e atualize `version` em `app-config.js` para o mesmo número. Gere e assine o APK com a mesma chave usada nos aparelhos, e envie a versão superior em Atualização do app. Cada aparelho mostra o botão na próxima verificação. O Android ainda pede autorização para instalar apps desta origem e confirmação para concluir a instalação.

## Gerar APK de depuração

Com JDK 17 e Android SDK API 35 instalados:

```sh
cd android
gradlew.bat assembleDebug
```

O arquivo de teste é `android/app/build/outputs/apk/debug/app-debug.apk`. Para distribuir atualizações fora de um ambiente de teste, configure uma chave de assinatura de lançamento e mantenha-a protegida; a assinatura precisa corresponder à do app instalado.
