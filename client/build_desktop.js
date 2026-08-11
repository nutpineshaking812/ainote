const { execSync } = require('child_process');

try {
  console.log('====== [1/2] 正在打包前端 Web 静态资源... ======');
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });

  console.log('\n====== [2/2] 正在打包 Tauri 桌面端安装包 (宿主平台原生编译)... ======');
  execSync('npx tauri build', { stdio: 'inherit', cwd: __dirname });

  console.log('\n✨ AINote 桌面安装包编译打包成功！安装文件已输出在 src-tauri/target/release/bundle/ 目录中。');
} catch (error) {
  console.error('\n❌ 打包编译失败:', error.message);
  process.exit(1);
}
