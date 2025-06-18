{pkgs}: {
  channel = "stable-24.11"; # o "unstable"

  packages = [
    pkgs.nodejs_20
    pkgs.zulu
    # Añade Python con openpyxl como un único paquete integrado
    (pkgs.python3.withPackages (ps: [ ps.openpyxl ]))
  ];

  env = {
    # Fuerza el Python de Nix como el predeterminado
    PYTHONPATH = "${pkgs.python3.withPackages (ps: [ ps.openpyxl ])}/${pkgs.python3.sitePackages}";
  };

  # Resto de tu configuración existente...
  services.firebase.emulators = {
    detect = true;
    projectId = "demo-app";
    services = ["auth" "firestore"];
  };
  
  idx = {
    extensions = [];
    workspace = {
      onCreate = {
        default.openFiles = ["src/app/page.tsx"];
      };
    };
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}