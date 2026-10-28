package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Version;
import org.hibernate.annotations.Check;

/** Shared Battle settings independent of the music playlist. */
@Entity
@Table(name = "tbl_battle_config")
@Check(constraints = "id = 1 AND lum_lucky_appearance IN ('PUMPKIN', 'LIGHTNING')")
public class BattleConfig {
    @Id
    private Integer id = 1;
    @Column(name = "lum_lucky_appearance", length = 16, nullable = false)
    private String lumLuckyAppearance = "PUMPKIN";
    @Version
    @Column(name = "revision", nullable = false)
    private Long revision;

    public Integer getId() { return id; }
    public void setId(Integer value) { id = value; }
    public String getLumLuckyAppearance() { return lumLuckyAppearance; }
    public void setLumLuckyAppearance(String value) { lumLuckyAppearance = value; }
    public Long getRevision() { return revision; }
    public void setRevision(Long value) { revision = value; }
}
