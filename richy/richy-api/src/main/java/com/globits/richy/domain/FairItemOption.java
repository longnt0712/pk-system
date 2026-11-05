package com.globits.richy.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import javax.persistence.*;

@Entity
@Table(name = "tbl_fair_item_option", uniqueConstraints = @UniqueConstraint(
        name = "uk_fair_item_option_kind_name", columnNames = {"kind", "name_key"}))
public class FairItemOption {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @Column(nullable = false, length = 16)
    public String kind;
    @Column(nullable = false, length = 80, columnDefinition = "nvarchar(80)")
    public String name;
    @Column(name = "name_key", nullable = false, length = 80, columnDefinition = "nvarchar(80)")
    @JsonIgnore
    public String nameKey;
}
