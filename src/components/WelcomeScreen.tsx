import './WelcomeScreen.css';

interface WelcomeScreenProps {
  onChoice: (hasCV: boolean) => void;
}

export function WelcomeScreen({ onChoice }: WelcomeScreenProps) {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <h1>Bienvenue sur J1</h1>
        <p>Comment souhaitez-vous commencer ?</p>
        <div className="welcome-buttons">
          <button onClick={() => onChoice(true)} className="btn-primary">
            J'ai un CV à importer
          </button>
          <button onClick={() => onChoice(false)} className="btn-secondary">
            Partir de zéro
          </button>
        </div>
      </div>
    </div>
  );
}
