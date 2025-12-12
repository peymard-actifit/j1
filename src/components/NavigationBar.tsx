import './NavigationBar.css';

interface NavigationBarProps {
  onModuleClick: (module: string) => void;
  onAIClick: () => void;
}

const MODULES = [
  { id: 'justpush', name: 'JustPush', icon: '📤' },
  { id: 'justweb', name: 'JustWeb', icon: '🌐' },
  { id: 'justboost', name: 'JustBoost', icon: '🚀' },
  { id: 'justfind', name: 'JustFind', icon: '🔍' },
  { id: 'jobdone', name: 'JobDone', icon: '✅' },
  { id: 'justrpa', name: 'JustRPA', icon: '🤖' },
];

// Récupérer la version depuis package.json
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.67.0';

export const NavigationBar = ({ onModuleClick, onAIClick }: NavigationBarProps) => {
  return (
    <nav className="navigation-bar">
      <div className="nav-modules">
        {MODULES.map(module => (
          <button
            key={module.id}
            className="nav-module-button"
            onClick={() => onModuleClick(module.id)}
            title={module.name}
          >
            <span className="nav-module-icon">{module.icon}</span>
            <span className="nav-module-name">{module.name}</span>
          </button>
        ))}
      </div>
      <div className="nav-right-section">
        <span className="nav-version">v{APP_VERSION}</span>
        <button className="nav-ai-button" onClick={onAIClick} title="IA">
          🤖 IA
        </button>
      </div>
    </nav>
  );
};

