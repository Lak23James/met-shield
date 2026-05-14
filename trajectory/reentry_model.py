import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
import os
Rho_0=1.225 #sea level air density in kg/m^3
H_scale = 8500.0          # Scale height of Earth's atmosphere (m)
K_SUTTON = 1.7415e-4      # Sutton-Graves constant for Earth
NOSE_RADIUS = 1.5         # Spacecraft nose radius in meters

# Re-entry parameters
ENTRY_ALTITUDE = 120000.0 # 120 km (Karman Line)
FINAL_ALTITUDE = 10000.0  # 10 km (Parachute deployment)
ENTRY_VELOCITY = 7800.0   # Orbital velocity (m/s)
FINAL_VELOCITY = 300.0    # Terminal velocity before chutes (m/s)
TOTAL_TIME = 400.0        # Seconds of atmospheric re-entry bur
def exponential_density(h):
    return Rho_0 * np.exp(-h / H_scale)
def sutton_graves_heating(v,rho,r_n=NOSE_RADIUS,K=K_SUTTON):
    return K*(rho/r_n)**0.5*v**3
def generate_reentry_trajectory():
    print("Generating Geospatial Re-entry Trajectory...")
    
    # 1. Create time array
    t = np.linspace(0, TOTAL_TIME, 400)
    progress = t / TOTAL_TIME
    
    # 2. Flight path (Lon/Lat) - Indian Ocean Drop
    lon = np.linspace(110.0, 85.0, len(t))
    lat = np.linspace(-20.0, 10.0, len(t))
    
    # 3. Kinematics (Slowing down and dropping)
    alt = ENTRY_ALTITUDE - (ENTRY_ALTITUDE - FINAL_ALTITUDE) * np.sin(progress * np.pi / 2)
    v = ENTRY_VELOCITY - (ENTRY_VELOCITY - FINAL_VELOCITY) * (1 / (1 + np.exp(-10 * (progress - 0.6))))
    
    
    rho = exponential_density(alt)
    q_flux = sutton_graves_heating(v,rho)
    
   
    df = pd.DataFrame({
        'Time': t,
        'Longitude': lon,
        'Latitude': lat,
        'Altitude': alt,
        'Velocity': v,
        'Density': rho,
        'HeatFlux': q_flux
    })
    
    
    gdf = gpd.GeoDataFrame(
    df,
    geometry=[Point(xy) for xy in zip(lon, lat)],
    crs="EPSG:4326"
)
    

# 7. Save the data
    output_dir = "trajectory"
    os.makedirs(output_dir, exist_ok=True)
    
    gdf.to_csv(os.path.join(output_dir, "reentry_data.csv"), index=False)
    gdf.to_file(os.path.join(output_dir, "reentry_trajectory.geojson"), driver="GeoJSON")
    print(f"Re-entry data saved to {output_dir}/")
if __name__ == "__main__":
    generate_reentry_trajectory()