addEventListener('fetch', event => {
    const { request } = event;
    if (request.method === 'POST' && new URL(request.url).pathname === '/webhook') {
      handleTelegramWebhook(request);
    } else {
      event.respondWith(new Response('Not Found', { status: 404 }));
    }
  });
  
  async function handleTelegramWebhook(request) {
    const data = await request.json();
    if (data.message) {
      const message = data.message;
      const chatId = message.chat.id;
      const text = message.text;
      const userId = message.from.id;
  
      // Check if the user is an admin
      const isAdmin = await isUserAdmin(userId);
  
      if (isAdmin) {
        // Admin commands
        if (text.startsWith('/editmsg')) {
          // Edit message logic
        } else if (text.startsWith('/editfile')) {
          // Edit file logic
        }
      } else {
        // Client commands
        if (text === '/register') {
          // Registration logic
        } else if (text === '/portfolio') {
          // Portfolio generation logic
        }
      }
    } else if (data.callback_query) {
      // Handle callback queries (e.g., button presses)
    }
  }
  
  async function isUserAdmin(userId) {
    // Check if the user ID is in the admin list stored in KV
    const adminList = await KV_ADMIN.get('admin_list');
    return adminList.includes(userId);
  }