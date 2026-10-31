import Terminal from '../components/Terminal';

export default function Workspace() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1e1e1e',
        padding: '8px',
        boxSizing: 'border-box',
      }}
    >
      <Terminal />
    </div>
  );
}
