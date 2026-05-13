#include "VoxelGrid.hpp"
#include <algorithm> 
#include <cstdlib>
#include <random>


namespace metshield { 
int VoxelGrid::calculateGrainEnergy(size_t x, size_t y, size_t z, uint32_t target_grain) const {
    int energy = 0;
    // Kronecker delta Hamiltonian (Energy +1 for every mismatched boundary)
    if (getGrain(x-1, y, z) != target_grain) energy++;
    if (getGrain(x+1, y, z) != target_grain) energy++;
    if (getGrain(x, y-1, z) != target_grain) energy++;
    if (getGrain(x, y+1, z) != target_grain) energy++;
    if (getGrain(x, y, z-1) != target_grain) energy++;
    if (getGrain(x, y, z+1) != target_grain) energy++;
    return energy;
}

void VoxelGrid::stepMetallurgy() {
    // Standard Monte Carlo Setup
    std::mt19937 rng(std::random_device{}()); 
    std::uniform_int_distribution<size_t> dist_x(1, m_width - 2);  // Skipping edges
    std::uniform_int_distribution<size_t> dist_y(1, m_height - 2);
    std::uniform_int_distribution<size_t> dist_z(1, m_depth - 2);
    std::uniform_int_distribution<int> dist_neighbor(0, 5); 
    
    size_t total_voxels = m_width * m_height * m_depth;
    
    // One "Monte Carlo Step" (MCS) equals N random site trials
    for(size_t iter = 0; iter < total_voxels; iter++) {
        
        // Pick a random center voxel
        size_t c_x = dist_x(rng);
        size_t c_y = dist_y(rng);
        size_t c_z = dist_z(rng);
        
        uint32_t current_grain = getGrain(c_x, c_y, c_z);

        // Calculate current energy
        int curr_energy = calculateGrainEnergy(c_x, c_y, c_z, current_grain);
        
        // If energy is 0, it is surrounded by its own grain. Skip to save CPU time!
        if(curr_energy == 0) continue;
        
        // Randomly select one neighbor
        int n_idx = dist_neighbor(rng);
        size_t nx = c_x, ny = c_y, nz = c_z;
        switch (n_idx) {
            case 0: nx--; break; // Left
            case 1: nx++; break; // Right
            case 2: ny--; break; // Down
            case 3: ny++; break; // Up
            case 4: nz--; break; // Back
            case 5: nz++; break; // Front
        }

        uint32_t n_grain = getGrain(nx, ny, nz);
        if (n_grain == current_grain) continue;
        
      
        int new_energy = calculateGrainEnergy(c_x, c_y, c_z, n_grain);
        
        // Metropolis Criterion (If energy drops or stays same, accept the change!)
        if (new_energy <= curr_energy) {
            // setGrain surgically updates the grain bits without destroying Temp or Phase.
            setGrain(c_x, c_y, c_z, n_grain);
        }
        float temp = getTemp(c_x, c_y, c_z);
        uint8_t phase = getPhase(c_x, c_y, c_z); 

        // THE GIBBS FREE ENERGY  
        // The pre-calculated Beta Transus point where G_beta becomes lower than G_alpha 
        if (temp > 1250.0f && phase == static_cast<uint8_t>(PhaseID::SOLID_ALPHA)) {
            setPhase(c_x, c_y, c_z, static_cast<uint8_t>(PhaseID::SOLID_BETA));
        }         
        else if (temp <= 1250.0f && phase == static_cast<uint8_t>(PhaseID::SOLID_BETA)) {
            setPhase(c_x, c_y, c_z, static_cast<uint8_t>(PhaseID::SOLID_ALPHA));
        }
    }
}
void VoxelGrid::initDefaultstate() {
    // 1. Pack the 20.0f temperature into the top 32 bits
    uint32_t tempBits = std::bit_cast<uint32_t>(20.0f);
    uint64_t base_voxel = static_cast<uint64_t>(tempBits) << 32;

    // 2. The Ultra-Fast 1D Loop
    for (size_t i = 0; i < m_data.size(); ++i) {
        uint32_t random_grain = (rand() % 100) + 1; // Random grain between 1 and 100
        
        // Because Grain is at the very bottom (bits 0-23) and Phase is 0,
        // we can just use bitwise OR to pack the grain instantly.
        m_data[i] = base_voxel | random_grain; 
    }
}
// function for heat transfer simulation
void VoxelGrid::stepThermalFDM(float alpha, float dt) {
   
    
    std::fill(m_next_temp.begin(), m_next_temp.end(), 0.0f);

  
    // We only go from 1 to size-1 because boundaries need special handling.
    for(size_t z = 1; z < m_depth - 1; z++) {
        for(size_t y = 1; y < m_height - 1; y++) {
            for(size_t x = 1; x < m_width - 1; x++) {
                
                float T_center = getTemp(x,y,z);
                
                // Getting the temperatures of the neighbours
                float T_left   = getTemp(x-1,y,z);
                float T_right  = getTemp(x+1,y,z);
                float T_bottom = getTemp(x,y-1,z);
                float T_top    = getTemp(x,y+1,z);
                float T_back   = getTemp(x,y,z-1);
                float T_front  = getTemp(x,y,z+1);
                
                // Calculating the temperature of the next time step dt
                float lap = T_left+T_right+T_bottom+T_top+T_back+T_front - 6*T_center;
                
                
                float delta_temp = alpha * dt * lap;
                
                m_next_temp[getIndex(x,y,z)] = T_center + delta_temp;
            }
        }
    } 

    // --- BOUNDARY CONDITION 1: DIRICHLET (BOTTOM FACE: z = 0) ---
    // Pinned to 20.0 C to simulate the spacecraft's internal cooling system.
    for (size_t y = 0; y < m_height; ++y) {
        for (size_t x = 0; x < m_width; ++x) {
            m_next_temp[getIndex(x, y, 0)] = 20.0f;
        }
    }

    // --- BOUNDARY CONDITION 2: NEUMANN (TOP FACE: z = m_depth - 1) ---
    // Plasma heat flux entering the outer skin of the shield.
    float plasma_flux = 500.0f; 
    size_t top_z = m_depth - 1;
    for (size_t y = 0; y < m_height; ++y) {
        for (size_t x = 0; x < m_width; ++x) {
            float current_T = getTemp(x, y, top_z);
            m_next_temp[getIndex(x, y, top_z)] = current_T + (plasma_flux * dt);
        }
    }

    // --- LOOP 2: COMMIT ALL CHANGES ---
    // We include z=0 to m_depth to commit the top/bottom boundaries, 
    // but skip X and Y edges (1 to -1) to insulate the outer walls!
    for (size_t z = 0; z < m_depth; ++z) {
        for (size_t y = 1; y < m_height - 1; ++y) {
            for (size_t x = 1; x < m_width - 1; ++x) {
                setTemp(x, y, z, m_next_temp[getIndex(x, y, z)]);
            }
        }
    }
}

} 
