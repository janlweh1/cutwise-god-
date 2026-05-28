import buildingImg from "../../assets/ottodrone.jpg";

export const HeroPanel = () => {
  return (
    <div 
      className="auth-hero-panel" 
      style={{ backgroundImage: `url(${buildingImg})` }}
    >
      <div className="auth-hero-overlay"></div>
      <div className="auth-hero-content">
        <h1 className="auth-hero-title">Crafting Excellence<br />Since 1989</h1>
        <p className="auth-hero-text">
          Premium handcrafted footwear made with the finest materials.
        </p>
        <p className="auth-hero-text-sub">
          Quality leather, timeless design, unmatched comfort.
        </p>
      </div>
    </div>
  );
};
export default HeroPanel;
