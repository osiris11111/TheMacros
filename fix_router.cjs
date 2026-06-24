const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf-8');

app = app.replace(
  "import { CartItem, MenuItem, MenuCategory, OperationType } from './types';",
  "import { CartItem, MenuItem, MenuCategory, OperationType } from './types';\nimport { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate, Link } from 'react-router-dom';"
);

app = app.replace(
  "function BottomNav({ currentView, setView, isAdmin }: { currentView: string, setView: (v: string) => void, isAdmin: boolean }) {",
  "function BottomNav() {\n  const location = useLocation();\n  const currentView = location.pathname === '/' ? 'home' : location.pathname.substring(1);\n"
);

// Remove the isAdmin parameter from BottomNav and its button
app = app.replace(
  /{isAdmin && \([\s\S]*?\)}/m,
  ""
);

app = app.replace(/onClick=\{\(\) => setView\('home'\)\}/g, "onClick={() => {}}");
app = app.replace(/onClick=\{\(\) => setView\('menu'\)\}/g, "onClick={() => {}}");
app = app.replace(/onClick=\{\(\) => setView\('packages'\)\}/g, "onClick={() => {}}");
app = app.replace(/onClick=\{\(\) => setView\('checkout'\)\}/g, "onClick={() => {}}");
app = app.replace(/onClick=\{\(\) => setView\('profile'\)\}/g, "onClick={() => {}}");

app = app.replace(/<button onClick=\{\(\) => \{\}\} className=\{`([^`]+)`\}>\s*<span className="material-symbols-outlined text-2xl">([^<]+)<\/span>\s*<span className="text-\[10px\] font-medium mt-1">([^<]+)<\/span>\s*<\/button>/g, (match, classNames, icon, text) => {
    let to = '/';
    if (text === 'Menu') to = '/menu';
    else if (text === 'Packages') to = '/packages';
    else if (text === 'Cart') to = '/checkout';
    else if (text === 'Orders') to = '/profile';
    return `<Link to="${to}" className={\`${classNames}\`}>\n          <span className="material-symbols-outlined text-2xl">${icon}</span>\n          <span className="text-[10px] font-medium mt-1">${text}</span>\n        </Link>`;
});

app = app.replace(
  "function TopBar({ currentView }: { currentView: string }) {",
  "function TopBar() {\n  const location = useLocation();\n  const currentView = location.pathname === '/' ? 'home' : location.pathname.substring(1);"
);

app = app.replace(
  "export default function App() {\n  const [currentView, setCurrentView] = useState('home');",
  "function AppContent() {\n  const navigate = useNavigate();\n  const setView = (v: string) => navigate(v === 'home' ? '/' : `/${v}`);"
);

app = app.replace(
  /<div className="flex-grow">[\s\S]*?<\/div>/m,
  `<div className="flex-grow">
          <Routes>
            <Route path="/" element={<Home setView={setView} />} />
            <Route path="/menu" element={<Menu setView={setView} cartItems={cartItems} setCartItems={setCartItems} isAdmin={isAdmin} isBagOpen={isBagOpen} setIsBagOpen={setIsBagOpen} menuItemsList={menuItems} categoriesList={categories} user={user} favorites={favorites} isLoading={isLoadingMenu} />} />
            <Route path="/packages" element={<Packages setView={setView} cartItems={cartItems} setCartItems={setCartItems} isBagOpen={isBagOpen} setIsBagOpen={setIsBagOpen} menuItemsList={menuItems} isLoading={isLoadingMenu} />} />
            <Route path="/checkout" element={<Checkout setView={setView} cartItems={cartItems} setCartItems={setCartItems} user={user} isBagOpen={isBagOpen} setIsBagOpen={setIsBagOpen} />} />
            <Route path="/profile" element={<Profile user={user} setView={setView} favorites={favorites} menuItemsList={menuItems} setCartItems={setCartItems} />} />
            <Route path="/admin" element={isAdmin ? <Admin user={user} menuItemsList={menuItems} categoriesList={categories} setMenuItems={setMenuItems} setCategories={setCategories} /> : <div className="p-8 text-center mt-32"><p className="mb-4">Admin access required.</p><button onClick={() => setView('home')} className="text-primary font-bold">Go Home</button></div>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>`
);

app = app.replace(
  /<TopBar currentView=\{currentView\} \/>/,
  `<TopBar />`
);

app = app.replace(
  /<BottomNav currentView=\{currentView\} setView=\{setCurrentView\} isAdmin=\{isAdmin\} \/>/,
  `<BottomNav />`
);

app += `\n\nexport default function App() {\n  return (\n    <Router>\n      <AppContent />\n    </Router>\n  );\n}\n`;

fs.writeFileSync('src/App.tsx', app);
console.log('App updated.');
