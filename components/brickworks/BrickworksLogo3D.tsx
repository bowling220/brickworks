const letters = [
  ["B", "#ff3b43"], ["R", "#ffbf25"], ["I", "#178cff"], ["C", "#31c75a"], ["K", "#ff762b"],
  ["W", "#178cff"], ["O", "#ffd22f"], ["R", "#ff3b43"], ["K", "#31c75a"], ["S", "#178cff"],
] as const;

export function BrickworksLogo3D() {
  return (
    <div className="logo-wrap">
      <div className="logo-platform" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <span key={index} />)}</div>
      <h1 id="brickworks-title" className="brick-logo" aria-label="Brickworks">
        {letters.map(([letter, color], index) => (
          <span key={`${letter}-${index}`} style={{ "--letter-color": color } as React.CSSProperties}>{letter}<b aria-hidden="true" /><i aria-hidden="true" /></span>
        ))}
      </h1>
      <p className="logo-tagline">BUILD YOUR NEXT ADVENTURE</p>
    </div>
  );
}
