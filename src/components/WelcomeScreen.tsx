import './WelcomeScreen.css';

interface WelcomeScreenProps {
  onChoice: (hasCV: boolean) => void;
}

export const WelcomeScreen = ({ onChoice }: WelcomeScreenProps) => {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <h1 className="welcome-title">JustOne</h1>
        <p className="welcome-subtitle">Gestion de production de CVs</p>
        
        <div className="welcome-choices">
          <button 
            className="welcome-button"
            onClick={() => onChoice(true)}
          >
            J'ai un CV
          </button>
          <button 
            className="welcome-button"
            onClick={() => onChoice(false)}
          >
            Partir de zéro
          </button>
        </div>
      </div>
    </div>
  );
};

