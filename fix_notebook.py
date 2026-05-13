import json

file_path = "pinn/Physics_Informed_Brain.ipynb"

with open(file_path, "r") as f:
    data = json.load(f)

# Find the cell containing 'def Calculate_loss'
for cell in data['cells']:
    if cell['cell_type'] == 'code' and len(cell['source']) > 0 and 'def Calculate_loss' in cell['source'][0]:
        cell['source'] = [
            "def Calculate_loss(model, x, t, alpha=1.0):\n",
            "    x.requires_grad_(True)\n",
            "    t.requires_grad_(True)\n",
            "    T = model(x, t)\n",
            "    \n",
            "    # Calculate dT/dt\n",
            "    dT_dt = torch.autograd.grad(T, t, grad_outputs=torch.ones_like(T), create_graph=True)[0]\n",
            "    \n",
            "    # Calculate d^2T/dx^2\n",
            "    dT_dx = torch.autograd.grad(T, x, grad_outputs=torch.ones_like(T), create_graph=True)[0]\n",
            "    d2T_dx2 = torch.autograd.grad(dT_dx, x, grad_outputs=torch.ones_like(dT_dx), create_graph=True)[0]\n",
            "    \n",
            "    # Heat equation residual\n",
            "    residue = dT_dt - alpha * d2T_dx2\n",
            "    \n",
            "    # Return Mean Squared Error\n",
            "    return torch.mean(residue**2)\n"
        ]
        break

with open(file_path, "w") as f:
    json.dump(data, f, indent=1)
print("Successfully fixed notebook JSON!")
