"""
Met-Shield: Final 3D Physics-Informed Neural Network (Inference Only)
=====================================================================
This module loads the trained PINN weights and provides a clean API
to predict temperature at any (x, y, z, t) coordinate inside the
Titanium Ti-6Al-4V heat shield.

Usage:
    from FinalPINN import MetShieldPredictor

    predictor = MetShieldPredictor()

    # Single point query
    temp = predictor.predict(x=0.0, y=0.05, z=0.05, t=1.0)
    print(f"Temperature: {temp:.2f} K")

    # Batch query (numpy arrays)
    temps = predictor.predict_batch(x_arr, y_arr, z_arr, t_arr)
"""

import os
import torch
import torch.nn as nn
import numpy as np

# ============================================================
# CONSTANTS (must match the training notebook exactly)
# ============================================================
L = 0.1              # Shield thickness in meters (domain: [0, L]^3)
T_INITIAL = 300.0    # Room temperature (K)
T_SCALE = 2000.0     # Normalization scale used during training

# Default path to the trained weights (relative to this file)
_WEIGHTS_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_WEIGHTS_PATH = os.path.join(_WEIGHTS_DIR, "met_shield_3d_checkpoint.pth")


# ============================================================
# MODEL ARCHITECTURE (identical to the training notebook)
# ============================================================
class MetShield3D(nn.Module):
    """
    3D Physics-Informed Neural Network for heat transfer prediction.

    Architecture:
        Input:  4 neurons (x, y, z, t)
        Hidden: 4 layers x 256 neurons with Tanh activation
        Output: 1 neuron  (Temperature in Kelvin)

    The forward pass uses coordinate stretching (dividing spatial
    inputs by L) and a hard initial condition constraint that
    guarantees T = T_INITIAL at t = 0.
    """

    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(4, 256), nn.Tanh(),
            nn.Linear(256, 256), nn.Tanh(),
            nn.Linear(256, 256), nn.Tanh(),
            nn.Linear(256, 256), nn.Tanh(),
            nn.Linear(256, 1)
        )

    def forward(self, x, y, z, t):
        # Coordinate stretching: normalize spatial inputs to [0, 1]
        x_s = x / L
        y_s = y / L
        z_s = z / L
        raw_output = self.net(torch.cat([x_s, y_s, z_s, t], dim=1))

        # Hard initial condition: T = T_INITIAL when t = 0
        return T_INITIAL + (t * T_SCALE * raw_output)


# ============================================================
# PREDICTOR API
# ============================================================
class MetShieldPredictor:
    """
    High-level inference wrapper for the trained Met-Shield PINN.

    Loads the trained weights once, then provides fast temperature
    predictions without any training overhead.
    """

    def __init__(self, weights_path: str = _DEFAULT_WEIGHTS_PATH, device: str = "cpu"):
        """
        Args:
            weights_path: Path to the .pth file containing trained weights.
            device:       'cpu' or 'cuda'. Default is 'cpu' for portability.
        """
        self.device = torch.device(device)

        # Build the model and load trained weights
        self.model = MetShield3D().to(self.device)
        state_dict = torch.load(weights_path, map_location=self.device)
        self.model.load_state_dict(state_dict)

        # Switch to evaluation mode (disables dropout/batchnorm if any)
        self.model.eval()
        print(f"[Met-Shield PINN] Loaded weights from: {weights_path}")
        print(f"[Met-Shield PINN] Device: {self.device}")
        print(f"[Met-Shield PINN] Ready for inference.")

    @torch.no_grad()
    def predict(self, x: float, y: float, z: float, t: float) -> float:
        """
        Predict temperature at a single (x, y, z, t) point.

        Args:
            x: X-coordinate in meters [0, L]
            y: Y-coordinate in meters [0, L]
            z: Z-coordinate in meters [0, L] (0 = plasma face, L = back)
            t: Time in seconds [0, T_MAX]

        Returns:
            Predicted temperature in Kelvin.
        """
        x_t = torch.tensor([[x]], dtype=torch.float32, device=self.device)
        y_t = torch.tensor([[y]], dtype=torch.float32, device=self.device)
        z_t = torch.tensor([[z]], dtype=torch.float32, device=self.device)
        t_t = torch.tensor([[t]], dtype=torch.float32, device=self.device)

        T_pred = self.model(x_t, y_t, z_t, t_t)
        return T_pred.item()

    @torch.no_grad()
    def predict_batch(
        self,
        x: np.ndarray,
        y: np.ndarray,
        z: np.ndarray,
        t: np.ndarray
    ) -> np.ndarray:
        """
        Predict temperatures for a batch of (x, y, z, t) points.

        Args:
            x, y, z, t: 1D numpy arrays of equal length.

        Returns:
            1D numpy array of predicted temperatures in Kelvin.
        """
        x_t = torch.tensor(x, dtype=torch.float32, device=self.device).view(-1, 1)
        y_t = torch.tensor(y, dtype=torch.float32, device=self.device).view(-1, 1)
        z_t = torch.tensor(z, dtype=torch.float32, device=self.device).view(-1, 1)
        t_t = torch.tensor(t, dtype=torch.float32, device=self.device).view(-1, 1)

        T_pred = self.model(x_t, y_t, z_t, t_t)
        return T_pred.cpu().numpy().flatten()

    @torch.no_grad()
    def predict_grid_slice(
        self,
        axis: str = "z",
        n_points: int = 200,
        t: float = 1.0
    ) -> tuple:
        """
        Predict temperature along one axis through the center of the shield.

        Args:
            axis:     Which axis to sweep: 'x', 'y', or 'z'
            n_points: Number of sample points along the axis.
            t:        Time in seconds.

        Returns:
            (positions, temperatures) — both as 1D numpy arrays.
        """
        line = torch.linspace(0, L, n_points).view(-1, 1).to(self.device)
        mid = torch.ones(n_points, 1, device=self.device) * (L / 2)
        t_t = torch.ones(n_points, 1, device=self.device) * t

        if axis == "x":
            T_pred = self.model(line, mid, mid, t_t)
        elif axis == "y":
            T_pred = self.model(mid, line, mid, t_t)
        elif axis == "z":
            T_pred = self.model(mid, mid, line, t_t)
        else:
            raise ValueError(f"Invalid axis '{axis}'. Must be 'x', 'y', or 'z'.")

        return line.cpu().numpy().flatten(), T_pred.cpu().numpy().flatten()


# ============================================================
# STANDALONE TEST
# ============================================================
if __name__ == "__main__":
    print("=" * 60)
    print("  Met-Shield 3D PINN — Standalone Inference Test")
    print("=" * 60)

    predictor = MetShieldPredictor()

    # Test 1: Single point prediction
    print("\n--- Single Point Predictions ---")
    # Plasma face (z=0), center of shield, at t=1.0s — should be HOT
    temp_front = predictor.predict(x=L/2, y=L/2, z=0.0, t=1.0)
    print(f"  Front face (z=0.0):  {temp_front:.2f} K")

    # Middle of shield (z=L/2), at t=1.0s
    temp_mid = predictor.predict(x=L/2, y=L/2, z=L/2, t=1.0)
    print(f"  Middle     (z=L/2):  {temp_mid:.2f} K")

    # Back face (z=L), at t=1.0s — should be close to 300K
    temp_back = predictor.predict(x=L/2, y=L/2, z=L, t=1.0)
    print(f"  Back face  (z=L):    {temp_back:.2f} K")

    # Test 2: Grid slice along Z
    print("\n--- Z-Axis Temperature Profile (t=1.0s) ---")
    positions, temps = predictor.predict_grid_slice(axis="z", t=1.0)
    print(f"  z=0.000m -> {temps[0]:.2f} K")
    print(f"  z=0.050m -> {temps[len(temps)//2]:.2f} K")
    print(f"  z=0.100m -> {temps[-1]:.2f} K")

    print("\n" + "=" * 60)
    print("  Inference test complete. PINN is ready for integration.")
    print("=" * 60)
