import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Search, ShieldCheck, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

export const Sidebar: React.FC = () => {
  const { authUser, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const menuItems = [
    { path: '/',             icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { path: '/contratos',    icon: <FileText size={18} />,        label: 'Contratos' },
    { path: '/conformidade', icon: <ShieldCheck size={18} />,     label: 'Conformidade' },
    { path: '/importar',     icon: <Search size={18} />,          label: 'Importar PNCP' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon"><FileText size={15} /></div>
          <div>
            <span className="logo-text">ContratoPro</span>
            <p className="logo-sub">Gestão Pública</p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <p className="nav-section-label">Menu</p>
        <ul className="nav-list">
          {menuItems.map((item) => (
            <li key={item.path} className="nav-item">
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        {authUser && (
          <div className="user-info">
            <div className="user-avatar">
              <User size={14} />
            </div>
            <div className="user-details">
              <span className="user-name">{authUser.nome}</span>
              <span className={`user-role ${authUser.role === 'admin' ? 'user-role-admin' : ''}`}>
                {authUser.role === 'admin' ? 'Administrador' : 'Visualizador'}
              </span>
            </div>
          </div>
        )}
        <button className="nav-link logout-btn" onClick={handleLogout}>
          <span className="nav-icon"><LogOut size={18} /></span>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
};
