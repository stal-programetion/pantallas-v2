import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  UserCheck,
  Eye,
  ArrowRight,
  Sparkles,
  Lock,
  Flame,
  Check,
} from 'lucide-react';
import { SurtigasLogo } from '../components/common/SurtigasLogo';
import { useAuthStore } from '../store/useAuthStore';
import { UserRole } from '../types';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, setRole } = useAuthStore();
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUser.rol);

  const roles = [
    {
      role: 'ADMIN' as UserRole,
      title: 'Administrador General',
      user: 'Ing. Mauricio Beltrán',
      cargo: 'Gerente de Experiencia al Cliente y Canales',
      desc: 'Control total de la plataforma: configuración de conector Digiturno, reglas laborales, aprobación de planes y datos médicos.',
      icon: ShieldCheck,
      color: 'border-blue-600 bg-blue-50/50',
      badge: 'Acceso Total',
      permissions: [
        'Aprobación y firma de mallas',
        'Configuración de umbrales SLA y conector',
        'Acceso a diagnósticos de salud CIE-10',
        'CRUD de oficinas y colaboradores',
      ],
    },
    {
      role: 'COORDINADOR' as UserRole,
      title: 'Coordinador de Turnos',
      user: 'Liliana María Ramos',
      cargo: 'Coordinadora de Turnos y Gestión Operativa',
      desc: 'Gestión diaria de turnos, redistribuciones territoriales y cobertura de ausencias con visualización médica.',
      icon: UserCheck,
      color: 'border-orange-500 bg-orange-50/50',
      badge: 'Operación Principal',
      permissions: [
        'Aprobación de plan del día',
        'Edición manual de malla interactiva',
        'Aceptación de traslados sugeridos',
        'Gestión de ausencias e incapacidades',
      ],
    },
    {
      role: 'CONSULTA' as UserRole,
      title: 'Consulta / Asesor',
      user: 'Carlos Mario Mendoza',
      cargo: 'Asesor Integral Chambacú',
      desc: 'Visualización de turnos propios, tablero en vivo de colas Digiturno y reportes ejecutivos. Salud restringida.',
      icon: Eye,
      color: 'border-slate-400 bg-slate-50',
      badge: 'Solo Lectura',
      permissions: [
        'Monitoreo de colas en vivo',
        'Consulta de turnos asignados',
        '🔒 Datos médicos restringidos (Ley 1581)',
        'Sin permisos de edición ni aprobación',
      ],
    },
  ];

  const handleLogin = () => {
    setRole(selectedRole);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#1F2B6B] flex flex-col justify-center items-center p-6 select-none relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl relative z-10 space-y-8">
        {/* Surtigas Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="rounded-3xl bg-white px-8 py-4 shadow-xl">
              <SurtigasLogo size="lg" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Plataforma de Gestión y Optimización de Turnos
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Prototipo Funcional TRL 6 — 14 Oficinas de Atención al Cliente en Bolívar, Córdoba, Sucre, Antioquia y Magdalena.
          </p>
        </div>

        {/* Roles Selection Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-300">
              Selecciona tu Perfil de Acceso Simulado:
            </span>
            <span className="text-orange-400 font-mono">3 Roles Disponibles</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roles.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedRole === item.role;

              return (
                <div
                  key={item.role}
                  onClick={() => setSelectedRole(item.role)}
                  className={`p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? `${item.color} bg-white ring-4 ring-orange-500/20 shadow-xl scale-[1.02]`
                      : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                          isSelected
                            ? 'bg-blue-800 text-white'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        <Icon size={20} />
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    </div>

                    <div>
                      <h3
                        className={`font-bold text-sm ${
                          isSelected ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        {item.title}
                      </h3>
                      <div
                        className={`text-xs font-medium ${
                          isSelected ? 'text-blue-800' : 'text-orange-400'
                        }`}
                      >
                        {item.user}
                      </div>
                      <div
                        className={`text-[10px] mt-0.5 line-clamp-1 ${
                          isSelected ? 'text-slate-500' : 'text-slate-500'
                        }`}
                      >
                        {item.cargo}
                      </div>
                    </div>

                    <p
                      className={`text-xs leading-relaxed ${
                        isSelected ? 'text-slate-600' : 'text-slate-400'
                      }`}
                    >
                      {item.desc}
                    </p>
                  </div>

                  {/* Permissions Bullet Points */}
                  <div className="mt-4 pt-3 border-t border-slate-200/70 space-y-1.5 text-[11px]">
                    {item.permissions.map((perm, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-1.5 ${
                          isSelected ? 'text-slate-700' : 'text-slate-400'
                        }`}
                      >
                        <Check
                          size={12}
                          className={isSelected ? 'text-blue-700' : 'text-slate-500'}
                        />
                        <span className="truncate">{perm}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Enter Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Lock size={14} className="text-emerald-400" />
            <span>Acceso seguro certificado para operación regional de gas natural.</span>
          </div>

          <button
            onClick={handleLogin}
            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Ingresar a la Plataforma</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
