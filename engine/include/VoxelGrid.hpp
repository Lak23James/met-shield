#pragma once

#include <cstdint>
#include <vector>
#include <bit> 

namespace metshield {

// Representing the physical states of Aerospace Titanium (Ti-6Al-4V)
enum class PhaseID : uint8_t {
    SOLID_ALPHA = 0,
    SOLID_BETA  = 1,
    LIQUID      = 2,
    VAPOR       = 3
};

// Constant for liquids/gasses which have no crystal structure
const uint32_t GRAIN_UNSTRUCTURED = 0;

/**
 * @brief Represents the 3D domain of the microstructure using a flattened 1D array
 *        of bit-packed 64-bit integers to maximize CPU cache locality.
 */
class VoxelGrid {
public:
    // Boilerplate: Constructor allocates the exact memory needed upfront
    VoxelGrid(size_t width, size_t height, size_t depth)
        : m_width(width), m_height(height), m_depth(depth) {
        size_t total_voxels = width * height * depth;
        m_data.resize(total_voxels, 0);
        m_next_temp.resize(total_voxels, 0.0f); // Size the persistent double buffer!
    }

    // Boilerplate: 3D to 1D mapping. X changes fastest for cache locality.
    [[nodiscard]] inline size_t getIndex(size_t x, size_t y, size_t z) const {
        return x + (y * m_width) + (z * m_width * m_height);
    }
    
    // 1. Bitwise Getters
    [[nodiscard]] inline uint8_t getPhase(size_t x, size_t y, size_t z) const {
        uint64_t voxel = m_data[getIndex(x, y, z)];
        return static_cast<uint8_t>((voxel >> 24) & 0xFF);
    }

    [[nodiscard]] inline uint32_t getGrain(size_t x, size_t y, size_t z) const {
        uint64_t voxel = m_data[getIndex(x, y, z)];
        return static_cast<uint32_t>(voxel & 0xFFFFFF); // Grain is at bits 0-23
    }

    [[nodiscard]] inline float getTemp(size_t x, size_t y, size_t z) const {
        uint64_t voxel = m_data[getIndex(x, y, z)];
        // Shift right by 32 to bring temp down. Cast to uint32_t, then safely cast to float.
        uint32_t tempBits = static_cast<uint32_t>(voxel >> 32);
        return std::bit_cast<float>(tempBits);
    }
    
    // 2. Bitwise Setters
    inline void setPhase(size_t x, size_t y, size_t z, uint8_t phase) {
        size_t idx = getIndex(x, y, z);
        uint64_t& voxel = m_data[idx];
        
        voxel &= ~(0xFFULL << 24); 
        voxel |= (static_cast<uint64_t>(phase) << 24);
    }

    inline void setGrain(size_t x, size_t y, size_t z, uint32_t grain) {
        size_t idx = getIndex(x, y, z);
        uint64_t& voxel = m_data[idx];
        
        voxel &= ~(0xFFFFFFULL); 
        voxel |= (static_cast<uint64_t>(grain) & 0xFFFFFF);
    }
    
    inline void setTemp(size_t x, size_t y, size_t z, float temp) {
        size_t idx = getIndex(x, y, z);
        uint64_t& voxel = m_data[idx];
        
        // Disguise the float as a raw 32-bit integer for packing
        uint32_t tempBits = std::bit_cast<uint32_t>(temp);
        
        // Clear the top 32 bits (Temperature's slot)
        voxel &= ~(0xFFFFFFFFULL << 32); 
        
        // Insert the new bits at the top
        voxel |= (static_cast<uint64_t>(tempBits) << 32);
    }

    void stepThermalFDM(float alpha, float dt);
    int calculateGrainEnergy(size_t x, size_t y, size_t z, uint32_t target_grain);
    void stepMetallurgy();
    void initDefaultstate();

private:
    size_t m_width;
    size_t m_height;
    size_t m_depth;
    
    // The core memory architecture
    std::vector<uint64_t> m_data;
    
    // Persistent double buffer (Memory Optimization)
    std::vector<float> m_next_temp;
};

}
